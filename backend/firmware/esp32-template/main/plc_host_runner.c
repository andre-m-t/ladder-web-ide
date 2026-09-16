/* plc_host_runner -- executavel do contrato de processo descrito em
 * docs/validacao/contrato-runtime-host.md: roda a logica IEC de um arquivo
 * .st inteiramente no host, sem ESP32 e sem toolchain Xtensa.
 *
 * Este arquivo e um DRIVER, nao a logica em si. O programa do usuario so
 * vira codigo apos o iec2c gerar C a partir dele, e esse C so pode ser
 * ligado ao runtime autoral (plc_glue.c) e a HAL de host (plc_hal_stub.c) em
 * uma compilacao nova -- as variaveis localizadas sao simbolos C
 * (LOCATED_VARIABLES.h), nao dados carregaveis em tempo de execucao. Entao,
 * a cada chamada, este programa:
 *
 *   1. copia o .st recebido para um diretorio de trabalho TEMPORARIO, fora
 *      da arvore do repositorio (a mesma exigencia do deposito no INPI que
 *      proibe "generated/" e "build/" sob backend/firmware/ -- ver
 *      scripts/build-deposito.sh);
 *   2. chama `iec2c` para gerar o C, no mesmo padrao de invocacao de
 *      backend/app/services/matiec.py;
 *   3. chama `gcc` para compilar esse C junto com plc_glue.c e
 *      plc_hal_stub.c (o irmao deste arquivo, plc_host_cycle_runner.c, tem o
 *      main() que de fato le stdin e escreve stdout ciclo a ciclo);
 *   4. troca de processo (execv) para o binario resultante, que herda stdin/
 *      stdout/stderr e cujo codigo de saida vira o deste programa.
 *
 * Se iec2c ou gcc falharem, a saida bruta de quem falhou vai para o stderr
 * deste programa, integra (mesmo espirito do campo `raw` da Q-3), e o codigo
 * de saida e diferente de zero -- sem exec, sem tentar interpretar o erro.
 *
 * Uso (modo padrao, o unico documentado no contrato):
 *   plc_host_runner <arquivo.st>
 *
 * Uso (modo eletrico, nivel de pino):
 *   plc_host_runner --eletrico <arquivo.st>
 *
 * Todo argumento antes do ultimo (o .st) e repassado verbatim ao binario
 * compilado -- inclusive `--flip=<gpio>:<na_leitura>:<nivel>`, gancho
 * interno para backend/tests/test_plc_runtime_host.py exercitar
 * plc_hal_stub_flip_on_read (plc_hal_stub.h). Esse flag NAO faz parte do
 * contrato publicado; quem consome o contrato (a Frente C, em
 * backend/tests/diferencial/) nunca precisa dele.
 */

#define _POSIX_C_SOURCE 200809L

#include <limits.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

#ifndef PLC_HOST_MAIN_DIR
#error "PLC_HOST_MAIN_DIR precisa ser definido na compilacao (ver host/Makefile)"
#endif

static void falhar(const char *fmt, ...)
{
    va_list args;
    va_start(args, fmt);
    vfprintf(stderr, fmt, args);
    va_end(args);
    fprintf(stderr, "\n");
    exit(1);
}

static void copiar_arquivo(const char *origem, const char *destino)
{
    FILE *in = fopen(origem, "rb");
    if (!in) {
        falhar("plc_host_runner: nao foi possivel abrir '%s'", origem);
    }
    FILE *out = fopen(destino, "wb");
    if (!out) {
        fclose(in);
        falhar("plc_host_runner: nao foi possivel criar '%s'", destino);
    }
    char buf[4096];
    size_t n;
    while ((n = fread(buf, 1, sizeof(buf), in)) > 0) {
        fwrite(buf, 1, n, out);
    }
    fclose(in);
    fclose(out);
}

/* Roda um processo ate o fim, com stdout/stderr redirecionados para arquivos
 * (capturados so para o caso de falha -- ver despejar_saida_bruta). Devolve
 * o codigo de saida, ou -1 se o processo nao terminou normalmente. */
static int rodar(char *const argv[], const char *cwd, const char *stdout_path,
                  const char *stderr_path)
{
    pid_t pid = fork();
    if (pid < 0) {
        falhar("plc_host_runner: fork() falhou ao preparar '%s'", argv[0]);
    }
    if (pid == 0) {
        if (cwd && chdir(cwd) != 0) {
            _exit(127);
        }
        if (!freopen(stdout_path, "w", stdout) || !freopen(stderr_path, "w", stderr)) {
            _exit(127);
        }
        execvp(argv[0], argv);
        /* so chega aqui se execvp falhou (ferramenta ausente do PATH) */
        fprintf(stderr, "plc_host_runner: nao foi possivel executar '%s'\n", argv[0]);
        _exit(127);
    }
    int status = 0;
    if (waitpid(pid, &status, 0) < 0 || !WIFEXITED(status)) {
        return -1;
    }
    return WEXITSTATUS(status);
}

static void despejar_saida_bruta(const char *ferramenta, const char *stdout_path,
                                  const char *stderr_path)
{
    fprintf(stderr, "plc_host_runner: %s falhou; saida bruta:\n", ferramenta);
    const char *caminhos[2] = {stdout_path, stderr_path};
    for (int i = 0; i < 2; i++) {
        FILE *f = fopen(caminhos[i], "rb");
        if (!f) {
            continue;
        }
        char buf[4096];
        size_t n;
        while ((n = fread(buf, 1, sizeof(buf), f)) > 0) {
            fwrite(buf, 1, n, stderr);
        }
        fclose(f);
    }
}

int main(int argc, char **argv)
{
    if (argc < 2) {
        falhar("uso: %s [--eletrico] [--flip=<gpio>:<na_leitura>:<nivel>] <arquivo.st>", argv[0]);
    }

    const char *st_file = argv[argc - 1];
    int passthrough_count = argc - 2; /* argv[1..argc-2]: tudo antes do .st */

    const char *tmpdir_base = getenv("TMPDIR");
    if (!tmpdir_base || tmpdir_base[0] == '\0') {
        tmpdir_base = "/tmp";
    }

    char scratch[PATH_MAX];
    if (snprintf(scratch, sizeof(scratch), "%s/plc_host_runner_XXXXXX", tmpdir_base) >=
        (int)sizeof(scratch)) {
        falhar("plc_host_runner: TMPDIR muito longo");
    }
    if (!mkdtemp(scratch)) {
        falhar("plc_host_runner: nao foi possivel criar diretorio de trabalho em '%s'",
               tmpdir_base);
    }

    char st_path[PATH_MAX];
    snprintf(st_path, sizeof(st_path), "%s/plc.st", scratch);
    copiar_arquivo(st_file, st_path);

    const char *matiec_lib_dir = getenv("MATIEC_LIB_DIR");
    if (!matiec_lib_dir || matiec_lib_dir[0] == '\0') {
        matiec_lib_dir = "/usr/local/share/matiec/lib";
    }
    /* iec2c quer -I apontando para o diretorio "lib" (contem C/, ieclib.txt
     * etc.); o gcc, mais adiante, quer o subdiretorio lib/C especificamente
     * (mesma distincao de backend/app/services/matiec.py vs.
     * main/CMakeLists.txt: MATIEC_LIB_C_DIR = $MATIEC_LIB_DIR/C). */
    char matiec_lib_c[PATH_MAX];
    snprintf(matiec_lib_c, sizeof(matiec_lib_c), "%s/C", matiec_lib_dir);

    /* -- iec2c: .st -> C. Mesmo padrao de invocacao de
     * backend/app/services/matiec.py (fonte como <out_dir>/plc.st, cwd no
     * diretorio de saida). -- */
    char iec2c_out[PATH_MAX], iec2c_err[PATH_MAX];
    snprintf(iec2c_out, sizeof(iec2c_out), "%s/.iec2c.stdout", scratch);
    snprintf(iec2c_err, sizeof(iec2c_err), "%s/.iec2c.stderr", scratch);
    char *iec2c_argv[] = {
        "iec2c", "-f", "-I", (char *)matiec_lib_dir, "-T", scratch, st_path, NULL,
    };
    int rc = rodar(iec2c_argv, scratch, iec2c_out, iec2c_err);
    if (rc != 0) {
        despejar_saida_bruta("iec2c", iec2c_out, iec2c_err);
        return 1;
    }

    /* -- gcc: liga o C gerado ao runtime autoral e a HAL de host --
     * mesma familia de flags testada e documentada no contrato desta rodada
     * (silencia so os avisos que vem dos cabecalhos do MATIEC e da biblioteca
     * padrao do IEC, nunca -Werror geral). */
    char config0[PATH_MAX], res0[PATH_MAX], inner_bin[PATH_MAX];
    snprintf(config0, sizeof(config0), "%s/Config0.c", scratch);
    snprintf(res0, sizeof(res0), "%s/Res0.c", scratch);
    snprintf(inner_bin, sizeof(inner_bin), "%s/plc_host_cycle_runner", scratch);

    char inc_main[PATH_MAX], inc_scratch[PATH_MAX], inc_matiec[PATH_MAX];
    snprintf(inc_main, sizeof(inc_main), "-I%s", PLC_HOST_MAIN_DIR);
    snprintf(inc_scratch, sizeof(inc_scratch), "-I%s", scratch);
    snprintf(inc_matiec, sizeof(inc_matiec), "-I%s", matiec_lib_c);

    char src_cycle[PATH_MAX], src_glue[PATH_MAX], src_stub[PATH_MAX];
    snprintf(src_cycle, sizeof(src_cycle), "%s/plc_host_cycle_runner.c", PLC_HOST_MAIN_DIR);
    snprintf(src_glue, sizeof(src_glue), "%s/plc_glue.c", PLC_HOST_MAIN_DIR);
    snprintf(src_stub, sizeof(src_stub), "%s/plc_hal_stub.c", PLC_HOST_MAIN_DIR);

    char *gcc_argv[] = {
        "gcc", "-std=c11", inc_main, inc_scratch, inc_matiec,
        "-Wno-pointer-sign", "-Wno-unused-function", "-Wno-unused-variable",
        "-Wno-unused-but-set-variable",
        "-o", inner_bin,
        src_cycle, src_glue, src_stub, config0, res0,
        NULL,
    };
    char gcc_out[PATH_MAX], gcc_err[PATH_MAX];
    snprintf(gcc_out, sizeof(gcc_out), "%s/.gcc.stdout", scratch);
    snprintf(gcc_err, sizeof(gcc_err), "%s/.gcc.stderr", scratch);
    rc = rodar(gcc_argv, scratch, gcc_out, gcc_err);
    if (rc != 0) {
        despejar_saida_bruta("gcc", gcc_out, gcc_err);
        return 1;
    }

    /* -- troca de processo: dali em diante quem fala com stdin/stdout e o
     * binario recem-compilado, sem processo intermediario. -- */
    char *inner_argv[argc]; /* espaco de sobra: no maximo argc ponteiros */
    int k = 0;
    inner_argv[k++] = inner_bin;
    for (int i = 1; i <= passthrough_count; i++) {
        inner_argv[k++] = argv[i];
    }
    inner_argv[k] = NULL;

    execv(inner_bin, inner_argv);
    falhar("plc_host_runner: nao foi possivel executar '%s'", inner_bin);
    return 1;
}

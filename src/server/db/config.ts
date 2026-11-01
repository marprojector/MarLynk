/**
 * Fallback URL used when database credentials are absent.
 *
 * `next build` collects page data for server routes, which imports the db
 * module. A build machine has no production credentials, so constructing the
 * client with `undefined` throws `URL_INVALID` and fails the whole build.
 * A syntactically valid placeholder lets the build finish; any real query
 * without credentials still fails loudly at request time.
 */
const BUILD_TIME_PLACEHOLDER_URL = "libsql://placeholder.invalid";

export function resolveTursoConfig(input: {
  url: string | undefined;
  token: string | undefined;
}): { url: string; authToken: string | undefined } {
  return {
    url: input.url ?? BUILD_TIME_PLACEHOLDER_URL,
    authToken: input.token,
  };
}

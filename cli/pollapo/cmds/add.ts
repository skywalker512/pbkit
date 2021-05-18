import { Command } from "https://deno.land/x/cliffy@v0.18.0/command/mod.ts";
import {
  Select,
  SelectValueOptions,
} from "https://deno.land/x/cliffy@v0.18.0/prompt/select.ts";
import { stringify } from "https://deno.land/std@0.93.0/encoding/yaml.ts";
import { cyan, yellow } from "https://deno.land/std@0.93.0/fmt/colors.ts";
import {
  getIsRepoExists,
  getRepoRevGroup,
  getToken,
  PollapoNotLoggedInError,
} from "../misc/github.ts";
import {
  PollapoUnauthorizedError,
  validateToken,
} from "../misc/github-auth.ts";
import backoff from "../misc/exponential-backoff.ts";
import {
  loadPollapoYml,
  parseDepFrag,
  PollapoYml,
  PollapoYmlNotFoundError,
  sanitizeDeps,
} from "../pollapoYml.ts";

interface Options {
  token?: string;
  config: string;
}

export default new Command()
  .arguments("<targets...:string>")
  .description("Add dependencies.")
  .option("-C, --config <value:string>", "Pollapo config", {
    default: "pollapo.yml",
  })
  .action(async (options: Options, targets: string[]) => {
    try {
      const token = options.token ?? await getToken();
      await backoff(
        () => validateToken(token),
        (err, i) => err instanceof PollapoUnauthorizedError || i >= 2,
      );
      let pollapoYml = await loadPollapoYml(options.config);
      for (const target of targets) {
        pollapoYml = await add(pollapoYml, target, token);
      }
      const pollapoYmlText = stringify(
        sanitizeDeps(pollapoYml) as Record<string, unknown>,
      );
      await Deno.writeTextFile(options.config, pollapoYmlText);
    } catch (err) {
      if (
        err instanceof PollapoNotLoggedInError ||
        err instanceof PollapoYmlNotFoundError ||
        err instanceof PollapoUnauthorizedError ||
        err instanceof PollapoRevNotFoundError ||
        err instanceof PollapoRepoNotFoundError
      ) {
        console.error(err.message);
        return Deno.exit(1);
      }
    }
  });

async function add(
  pollapoYml: PollapoYml,
  dep: string,
  token: string,
): Promise<PollapoYml> {
  const { user, repo, rev } = parseDepFrag(dep);
  const isRepoExists = await backoff(() =>
    getIsRepoExists({ token, user, repo })
  );
  if (!isRepoExists) throw new PollapoRepoNotFoundError(repo);
  const { tags, branches } = await backoff(() =>
    getRepoRevGroup({ token, user, repo })
  );
  if (rev) {
    if (![...tags, ...branches].find(({ name }) => name === rev)) {
      throw new PollapoRevNotFoundError(rev);
    }
    return pushDep(pollapoYml, dep);
  } else {
    const selectTargetMessage = (
      (tags.length && branches.length)
        ? "Tag or Branch"
        : tags.length
        ? "Tag"
        : "Branch"
    );
    const tagOptions = tags.map((tag) => ({ value: tag.name }));
    const branchOptions = branches.map((branch) => ({ value: branch.name }));
    const options: SelectValueOptions = (
      (tags.length && branches.length)
        ? [
          Select.separator(cyan("Tag")),
          ...tagOptions,
          Select.separator(cyan("Branch")),
          ...branchOptions,
        ]
        : [...tagOptions, ...branchOptions]
    );
    const selectedRevName = await Select.prompt({
      message: `Select ${selectTargetMessage} in ${yellow(user + "/" + repo)}`,
      search: true,
      options,
    });
    return pushDep(pollapoYml, `${user}/${repo}@${selectedRevName}`);
  }
}

function pushDep(pollapoYml: PollapoYml, dep: string): PollapoYml {
  const deps = pollapoYml?.deps ?? [];
  deps.push(dep);
  return { ...pollapoYml, deps };
}

class PollapoRevNotFoundError extends Error {
  constructor(rev: string) {
    super(`Revision \`${rev}\` is not found.`);
  }
}

class PollapoRepoNotFoundError extends Error {
  constructor(repo: string) {
    super(`Repository \`${repo}\` is not found.`);
  }
}

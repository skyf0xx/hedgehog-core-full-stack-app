import { formatFiles, Tree, updateJson } from '@nx/devkit';
import { moduleNames, ModuleNames } from '../naming';

interface ScreenGeneratorOptions {
  module: string;
  platforms?: string;
}

const WEB_ROOT = 'apps/web';
const MOBILE_ROOT = 'apps/mobile';

/**
 * Deliberately a skeleton: it wires the hook layer to a route and leaves
 * placeholders for the list, the filter shell, the empty state, and the
 * create/edit form. Layout, information hierarchy, and every other UX
 * judgment belong to ux-planner's rationale and front-end-eng's build, not
 * to a template that would make every module's screen look identical
 * before anyone decided it should. Applies equally to the mobile target
 * below — same restraint, translated to Expo Router/React Native
 * Reusables primitives instead of HTML elements.
 */
export default async function screenGenerator(
  tree: Tree,
  options: ScreenGeneratorOptions,
) {
  const names = moduleNames(options.module);
  const platforms = (options.platforms ?? 'web')
    .split(',')
    .map((platform) => platform.trim());

  if (platforms.includes('web')) {
    writeWebScreen(tree, names);
    addWebDependencies(tree);
  }

  if (platforms.includes('mobile')) {
    writeMobileScreen(tree, names);
    addMobileDependencies(tree);
  }

  await formatFiles(tree);
}

function writeWebScreen(tree: Tree, names: ModuleNames) {
  const dir = `${WEB_ROOT}/src/app/${names.module}`;

  tree.write(`${dir}/page.tsx`, pageFile(names));
  tree.write(`${dir}/${names.module}-screen.tsx`, screenFile(names));
  tree.write(`${dir}/${names.module}-form.tsx`, formFile(names));
  tree.write(`${dir}/${names.module}-screen.spec.tsx`, specFile(names));
}

function pageFile(names: ModuleNames): string {
  return `import { ${names.pascal}Screen } from './${names.module}-screen';

export default function ${names.pascal}Page() {
  return <${names.pascal}Screen />;
}
`;
}

function screenFile(names: ModuleNames): string {
  const { pascal, camel, entityPascal } = names;

  return `'use client';

import { useState } from 'react';
import { useRemove${entityPascal}, use${pascal} } from 'hooks';
import { ${pascal}Form } from './${names.module}-form';

export function ${pascal}Screen() {
  const { data, isPending, isError } = use${pascal}();
  const remove${entityPascal} = useRemove${entityPascal}();
  const [editingId, setEditingId] = useState<string | null>(null);

  if (isPending) {
    return <p>Loading ${names.module}…</p>;
  }

  if (isError) {
    return <p>${pascal} could not be loaded.</p>;
  }

  const ${camel} = data ?? [];

  return (
    <main>
      <header>
        <h1>${pascal}</h1>
        {/* Filter and tab shell — front-end-eng decides which facets a
            ${names.entityCamel} is filtered by, from ux-planner's rationale. */}
        <nav aria-label="${pascal} filters" />
      </header>

      <${pascal}Form
        editingId={editingId}
        onDone={() => setEditingId(null)}
      />

      {${camel}.length === 0 ? (
        <p>No ${names.module} yet.</p>
      ) : (
        <ul>
          {${camel}.map((${names.entityCamel}) => (
            <li key={${names.entityCamel}.id}>
              <button type="button" onClick={() => setEditingId(${names.entityCamel}.id)}>
                Edit
              </button>
              <button
                type="button"
                onClick={() => remove${entityPascal}.mutate(${names.entityCamel}.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
`;
}

function formFile(names: ModuleNames): string {
  const { pascal, entityPascal, entityCamel } = names;

  return `'use client';

import { useCreate${entityPascal} } from 'hooks';

interface ${pascal}FormProps {
  editingId: string | null;
  onDone: () => void;
}

export function ${pascal}Form({ editingId, onDone }: ${pascal}FormProps) {
  const create${entityPascal} = useCreate${entityPascal}();

  return (
    <form
      aria-label={editingId ? 'Edit ${entityCamel}' : 'Create ${entityCamel}'}
      onSubmit={(event) => {
        event.preventDefault();
        onDone();
      }}
    >
      {/* Fields, validation feedback, and submit affordance are
          front-end-eng's, built against the contract's own create/update
          schema rather than duplicated here. */}
      <button type="submit" disabled={create${entityPascal}.isPending}>
        Save
      </button>
    </form>
  );
}
`;
}

function specFile(names: ModuleNames): string {
  const { pascal, entityPascal } = names;

  return `import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ${pascal}Screen } from './${names.module}-screen';

// Hoisted above the import above by Vitest, which is what lets the screen
// render against stubbed hooks instead of a live API.
vi.mock('hooks', () => ({
  use${pascal}: vi.fn(() => ({ data: [], isPending: false, isError: false })),
  useCreate${entityPascal}: vi.fn(() => ({ isPending: false, mutate: vi.fn() })),
  useRemove${entityPascal}: vi.fn(() => ({ isPending: false, mutate: vi.fn() })),
}));

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <${pascal}Screen />
    </QueryClientProvider>,
  );
}

describe('${pascal}Screen', () => {
  it('renders the empty state when the hook returns no rows', () => {
    renderScreen();

    expect(screen.getByText(/no ${names.module} yet/i)).toBeInTheDocument();
  });

  it('renders the filter shell and the create form', () => {
    renderScreen();

    expect(
      screen.getByRole('navigation', { name: /${names.module} filters/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('form', { name: /create /i }),
    ).toBeInTheDocument();
  });
});
`;
}

/**
 * apps/web consumes the hook package as TypeScript source, so the
 * dependency and the project reference both have to exist before the
 * screen's own import resolves.
 */
function addWebDependencies(tree: Tree) {
  updateJson(tree, `${WEB_ROOT}/package.json`, (json) => {
    json.dependencies = {
      ...json.dependencies,
      contracts: 'workspace:*',
      hooks: 'workspace:*',
    };
    return json;
  });

  for (const config of ['tsconfig.json', 'tsconfig.spec.json']) {
    updateJson(tree, `${WEB_ROOT}/${config}`, (json) => {
      const references: { path: string }[] = json.references ?? [];
      for (const path of ['../../packages/contracts', '../../packages/hooks']) {
        if (!references.some((entry) => entry.path === path)) {
          references.push({ path });
        }
      }
      json.references = references;
      return json;
    });
  }
}

/**
 * Same skeleton as the web target, translated to Expo Router's file-based
 * routing and React Native Reusables/NativeWind primitives (`Text`,
 * `Button`) instead of `apps/web`'s HTML elements — same hook, same
 * placeholders, same deferral of layout to ux-planner's rationale and
 * front-end-eng's build.
 *
 * Expo Router only resolves routes under `src/app/`, so the route file
 * itself lands there as a thin re-export — same shape as `apps/web`'s own
 * `page.tsx` — while the screen, form, and spec live under
 * `src/{module}/`, matching core.yaml's scope glob for this layer.
 */
function writeMobileScreen(tree: Tree, names: ModuleNames) {
  const dir = `${MOBILE_ROOT}/src/${names.module}`;

  tree.write(
    `${MOBILE_ROOT}/src/app/${names.module}.tsx`,
    mobileRouteFile(names),
  );
  tree.write(`${dir}/${names.module}-screen.tsx`, mobileScreenFile(names));
  tree.write(`${dir}/${names.module}-form.tsx`, mobileFormFile(names));
  tree.write(`${dir}/${names.module}-screen.spec.tsx`, mobileSpecFile(names));
}

function mobileRouteFile(names: ModuleNames): string {
  return `import { ${names.pascal}Screen } from '../${names.module}/${names.module}-screen';

export default function ${names.pascal}Route() {
  return <${names.pascal}Screen />;
}
`;
}

function mobileScreenFile(names: ModuleNames): string {
  const { pascal, camel, entityPascal } = names;

  return `import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useRemove${entityPascal}, use${pascal} } from 'hooks';
import { ${pascal}Form } from './${names.module}-form';

export function ${pascal}Screen() {
  const { data, isPending, isError } = use${pascal}();
  const remove${entityPascal} = useRemove${entityPascal}();
  const [editingId, setEditingId] = useState<string | null>(null);

  if (isPending) {
    return <Text>Loading ${names.module}…</Text>;
  }

  if (isError) {
    return <Text>${pascal} could not be loaded.</Text>;
  }

  const ${camel} = data ?? [];

  return (
    <View>
      <View>
        <Text variant="h1">${pascal}</Text>
        {/* Filter and tab shell — front-end-eng decides which facets a
            ${names.entityCamel} is filtered by, from ux-planner's rationale. */}
        <View accessibilityRole="menubar" accessibilityLabel="${pascal} filters" />
      </View>

      <${pascal}Form
        editingId={editingId}
        onDone={() => setEditingId(null)}
      />

      {${camel}.length === 0 ? (
        <Text>No ${names.module} yet.</Text>
      ) : (
        <View>
          {${camel}.map((${names.entityCamel}) => (
            <View key={${names.entityCamel}.id}>
              <Button onPress={() => setEditingId(${names.entityCamel}.id)}>
                <Text>Edit</Text>
              </Button>
              <Button onPress={() => remove${entityPascal}.mutate(${names.entityCamel}.id)}>
                <Text>Delete</Text>
              </Button>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
`;
}

function mobileFormFile(names: ModuleNames): string {
  const { pascal, entityPascal, entityCamel } = names;

  return `import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useCreate${entityPascal} } from 'hooks';

interface ${pascal}FormProps {
  editingId: string | null;
  onDone: () => void;
}

export function ${pascal}Form({ editingId, onDone }: ${pascal}FormProps) {
  const create${entityPascal} = useCreate${entityPascal}();

  return (
    <View
      accessibilityRole="none"
      accessibilityLabel={editingId ? 'Edit ${entityCamel}' : 'Create ${entityCamel}'}
    >
      {/* Fields, validation feedback, and submit affordance are
          front-end-eng's, built against the contract's own create/update
          schema rather than duplicated here. */}
      <Button disabled={create${entityPascal}.isPending} onPress={onDone}>
        <Text>Save</Text>
      </Button>
    </View>
  );
}
`;
}

function mobileSpecFile(names: ModuleNames): string {
  const { pascal, entityPascal } = names;

  return `import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import { ${pascal}Screen } from './${names.module}-screen';

// Hoisted above the import above by Jest, which is what lets the screen
// render against stubbed hooks instead of a live API.
jest.mock('hooks', () => ({
  use${pascal}: jest.fn(() => ({ data: [], isPending: false, isError: false })),
  useCreate${entityPascal}: jest.fn(() => ({ isPending: false, mutate: jest.fn() })),
  useRemove${entityPascal}: jest.fn(() => ({ isPending: false, mutate: jest.fn() })),
}));

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <${pascal}Screen />
    </QueryClientProvider>,
  );
}

describe('${pascal}Screen (mobile)', () => {
  it('renders the empty state when the hook returns no rows', () => {
    renderScreen();

    expect(screen.getByText(/no ${names.module} yet/i)).toBeTruthy();
  });

  it('renders the filter shell and the create form', () => {
    renderScreen();

    expect(screen.getByLabelText(/${names.module} filters/i)).toBeTruthy();
    expect(screen.getByLabelText(/create /i)).toBeTruthy();
  });
});
`;
}

/**
 * apps/mobile consumes the hook package as TypeScript source, same as
 * apps/web — the dependency and the project reference both have to exist
 * before the screen's own import resolves.
 */
function addMobileDependencies(tree: Tree) {
  updateJson(tree, `${MOBILE_ROOT}/package.json`, (json) => {
    json.dependencies = {
      ...json.dependencies,
      contracts: 'workspace:*',
      hooks: 'workspace:*',
    };
    return json;
  });

  for (const config of ['tsconfig.json', 'tsconfig.spec.json']) {
    if (!tree.exists(`${MOBILE_ROOT}/${config}`)) continue;

    updateJson(tree, `${MOBILE_ROOT}/${config}`, (json) => {
      const references: { path: string }[] = json.references ?? [];
      for (const path of ['../../packages/contracts', '../../packages/hooks']) {
        if (!references.some((entry) => entry.path === path)) {
          references.push({ path });
        }
      }
      json.references = references;
      return json;
    });
  }
}

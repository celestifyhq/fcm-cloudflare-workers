import pkg from '../package.json';

describe('published package manifest', () => {
  it('has no runtime dependencies', () => {
    expect((pkg as Record<string, unknown>).dependencies ?? {}).toEqual({});
  });

  it('has no peer dependencies', () => {
    expect((pkg as Record<string, unknown>).peerDependencies ?? {}).toEqual({});
  });

  it('keeps fixture-only packages as devDependencies', () => {
    expect(Object.keys(pkg.devDependencies)).toEqual(
      expect.arrayContaining(['@hono/zod-validator', 'hono', 'zod']),
    );
  });
});

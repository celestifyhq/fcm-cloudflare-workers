# Releasing a New Version

This project uses [Changesets](https://github.com/changesets/changesets) to manage versioning and publishing to npm. The process is automated using GitHub Actions.

## Steps to Release

1.  **Make your code changes**: Implement your features, bug fixes, etc., on a feature branch (e.g., `issue/your-issue-number` or `feat/short-description`).

2.  **Create a Changeset**:
    Before committing your changes, or after your main changes are staged, run the following command:
    ```bash
    npx changeset
    ```
    *   You will be prompted to select the package(s) to version (select `fcm-cloudflare-workers`).
    *   Choose the type of change according to [SemVer](https://semver.org/) (patch, minor, or major).
        *   `patch`: For bug fixes or very small changes (e.g., 2.0.0 -> 2.0.1)
        *   `minor`: For new features that are backward-compatible (e.g., 2.0.0 -> 2.1.0)
        *   `major`: For breaking changes (e.g., 2.0.0 -> 3.0.0)
    *   Enter a clear and concise summary of the changes. This summary will be used in the `CHANGELOG.md`.

3.  **Commit the Changeset and Your Code**:
    Add the generated changeset file (located in the `.changeset/` directory) and your code changes to git and commit them:
    ```bash
    git add .
    git commit -m "feat: your descriptive commit message (includes changeset)"
    ```
    Or, if you prefer separate commits:
    ```bash
    git add .changeset/your-changeset-name.md
    git commit -m "chore: add changeset for upcoming release"
    # then commit your code changes
    git add src/ # or other changed files
    git commit -m "feat: implemented new feature X"
    ```

4.  **Push Your Branch**:
    Push your feature branch to GitHub:
    ```bash
    git push origin your-branch-name
    ```

5.  **Create a Pull Request**:
    Go to the GitHub repository and create a Pull Request (PR) from your feature branch to the `main` branch.

6.  **Merge the Pull Request**:
    Once the PR is reviewed and approved, merge it into the `main` branch.

7.  **Automatic Version PR**:
    *   Upon merging to `main`, the `Publish to npm` GitHub Action (defined in `.github/workflows/npm-publish.yml`) will trigger.
    *   Because there are pending changesets, the action opens (or updates) a PR titled "chore: version packages" that bumps the version in `package.json`, updates `CHANGELOG.md` and removes the consumed changeset files. Nothing is published at this point.

8.  **Merge the Versioning Pull Request**:
    Review and merge the "chore: version packages" PR. The action runs again on `main`, finds no pending changesets, and runs `npx changeset publish`, which publishes the new version to npm (with provenance) and pushes a git tag and GitHub release.

Your package is now published with the new version!

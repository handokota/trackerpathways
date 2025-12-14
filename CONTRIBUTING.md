# Contributing

You're very welcome to contribute to Tracker Pathways! Please follow this guide to get started.

## Getting Started

You've found a bug, have a suggestion, or something else? Just create an issue on GitHub and we can get in touch.

## Development Workflow

1.  **Fork the repository**
    Click the "Fork" button at the top right of the repository page to create your own copy.

2.  **Clone your fork**
    ```bash
    git clone [https://github.com/handokota/trackerpathways.git](https://github.com/handokota/trackerpathways.git)
    cd trackerpathways
    ```

3.  **Create a new branch**
    Create a branch using the convention `<type>/<description>`.
    * Use `feat/` for new features or data additions.
    * Use `fix/` for bug fixes or data corrections.

    ```bash
    # Example for adding a tracker
    git checkout -b feat/add-tracker-aither
    
    # Example for fixing a typo
    git checkout -b fix/update-requirements
    ```

4.  **Install dependencies and run locally**
    ```bash
    npm install
    npm run dev
    ```

5.  **Make your changes**
    Edit the code or update `src/data/trackers.json`.

## Submit a Pull Request

Before you submit the pull request for review please ensure that:

1.  **The pull request naming follows the Conventional Commits specification:**

    ```text
    <type>[optional scope]: <description>
    ```

    Example:
    `fix: update requirements for Aither`

    Where **TYPE** can be:
    * `feat` - is a new feature
    * `doc` - documentation only changes
    * `fix` - a bug fix
    * `refactor` - code change that neither fixes a bug nor adds a feature

2.  **Your pull request has a detailed description**
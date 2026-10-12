# test-acme-helpdesk-copilot

**TESTING ONLY.** Acme Support's helpdesk copilot, a fixture for testing Preflight end to end with real pull requests and local models served by Ollama. Not a product.

- `config/models.json` names the model each feature uses. A pull request that changes it is a model change Preflight reviews.
- `.preflight/` holds the release checks, each tagged with the feature it covers.
- The workflow runs on a self-hosted runner labelled `preflight-lab`, which has `PREFLIGHT_CHECKOUT` and `PREFLIGHT_API_KEY` in its own environment (never in this repo).

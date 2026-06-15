# Provider Adapter Boundary

Production provider adapters should implement small, testable functions:

```js
export async function generateAsset({ prompt, connector, output }) {}
export async function generateVoice({ text, voice, connector, output }) {}
export async function renderBlenderScene({ storyboard, assets, output }) {}
export async function assembleVideo({ storyboard, videoParts, audioParts, output }) {}
export async function uploadFinalDraft({ fileUrl, caption, connector }) {}
```

Keep adapters side-effect focused. The API server should enqueue jobs; workers should run adapters.

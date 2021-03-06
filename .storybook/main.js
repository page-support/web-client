module.exports = {
  stories: [
    "../src/**/*.stories.mdx",
    "../src/**/*.stories.@(js|jsx|ts|tsx|svelte)"
  ],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-svelte-csf",
    "@storybook/addon-postcss",
    "@storybook/addon-controls"
  ],
  staticDirs: ['../dist'],
  framework: "@storybook/svelte",
  svelteOptions: {
    preprocess: require("svelte-preprocess")()
  }
}
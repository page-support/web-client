const sveltePreprocess = require("svelte-preprocess");

// See src/ui/Bot.stories.js for Bot component calling/params

module.exports = {
  stories: ['../src/ui/*.stories.@(ts|js)'],
  addons: [ '@storybook/addon-essentials',
            '@storybook/addon-postcss'
          ],

  webpackFinal: async (config) => {
    const svelteLoader = config.module.rules.find(
      (r) => r.loader && r.loader.includes("svelte-loader")
    );
    svelteLoader.options = {
      ...svelteLoader.options,
      preprocess: sveltePreprocess({ postcss: true }),
    };

    return config;
  },
};

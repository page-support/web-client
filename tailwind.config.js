// tailwind.config.js for tailwind v2
const isProduction = !process.env.ROLLUP_WATCH; // or some other env var like NODE_ENV

// https://tailwindcss.com/docs/customizing-colors only uncomment if you are
// adding custom colors or curating per docs or default colors will disappear.
//const colors = require('tailwindcss/colors');

module.exports = {
  plugins: [require('@tailwindcss/forms'),
            require('@tailwindcss/typography'),
            require('@tailwindcss/aspect-ratio')
          ],
  darkMode: 'class',
  content: ["./src/**/*.svelte", "./src/**/*.html"],
  theme: {
    /*  The theme section is used to REPLACE the existing Tailwind
        colors and fonts.  To ADD TO the existing ones, see the theme
        property below.  Example below from Tailwind docs 
    colors: {
      // Build your palette here
      transparent: 'transparent',
      current: 'currentColor',
      gray: colors.trueGray,
      red: colors.red,
      blue: colors.lightBlue,
      yellow: colors.amber,
    }
    */

    /* settings in extend property add to existing tailwind settings */
    extend: {
      colors: {
        /* in element CSS, refer to this as bg-bot-primary-color, text-*, 
         * border-* or whatever shorthand Tailwind uses to indicate where
         * the class is applied */
        'primary-color': 'var(--primary-color)',
        'secondary-color': 'var(--secondary-color)',
        'hover-color': 'var(--hover-color)',
        'container-color': 'var(--container-color)',
        'container-border-color': 'var(--container-border-color)',
      }
    },
  },
  variants: {},
};

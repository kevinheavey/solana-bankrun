module.exports = {
    /**
     * Ref：https://v1.vuepress.vuejs.org/config/#title
     */
    title: 'Bankrun',
  
    /**
     * Theme configuration, here is the default theme configuration for VuePress.
     *
     * ref：https://v1.vuepress.vuejs.org/theme/default-theme-config.html
     */
    themeConfig: {
      repo: 'kevinheavey/solana-bankrun',
      editLinks: false,
      docsDir: 'docs',
      editLinkText: '',
      lastUpdated: false,
      nav: [
        {
          text: 'Tutorial',
          link: '/tutorial/',
        },
        {
          text: 'API Reference',
          link: '/api/',
        },
      ],
      sidebar: {
        '/tutorial': 'auto',
        '/': 'auto',
      }
    },
  
    /**
     * Apply plugins，ref：https://v1.vuepress.vuejs.org/zh/plugin/
     */
    plugins: [
      [
        'vuepress-plugin-typedoc',
        {
          entryPoints: ['solana-bankrun/index.ts'],
          tsconfig: 'tsconfig.json',
          cleanOutputDir: true,
        },
      ],
    ],
    extendMarkdown: (md) => {
        // use more markdown-it plugins!
        md.use(require('markdown-it-include'))
    }
  };

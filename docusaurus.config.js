// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

const customPlugin = require('./src/remark/my_plugin')

/** @type {import('@docusaurus/types').Config} */
const config = {
    title: 'Песни',
    tagline: 'Християнски песни за хваление и поклонение',
    url: 'https://pesni.propovedi.org',
    baseUrl: '/',
    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'warn',
    favicon: 'img/logo_propovedi.png',

    // GitHub pages deployment config.
    // If you aren't using GitHub pages, you don't need these.
    //   organizationName: 'facebook', // Usually your GitHub org/user name.
    //   projectName: 'docusaurus', // Usually your repo name.

    // Even if you don't use internationalization, you can use this field to set useful
    // metadata like html lang. For example, if your site is Chinese, you may want
    // to replace "en" with "zh-Hans".
    i18n: {
        defaultLocale: 'bg',
        locales: ['bg'],
    },

    presets: [
        [
            'classic',
            /** @type {import('@docusaurus/preset-classic').Options} */
            ({
                docs: {
                    routeBasePath: '/',
                    sidebarPath: require.resolve('./sidebars.js'),
                    // remarkPlugins: [customPlugin]

                    // Please change this to your repo.
                    // Remove this to remove the "edit this page" links.
                    //   editUrl:
                    //     'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
                },
                blog: false,
                // {
                //   // showReadingTime: true,
                //   // // Please change this to your repo.
                //   // // Remove this to remove the "edit this page" links.
                //   // editUrl:
                //   //   'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
                // },
                theme: {
                    customCss: require.resolve('./src/css/custom.css'),
                },
            }),
        ],
    ],

    themeConfig:
        /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
        ({
            metadata: [
                {name: 'description', content: 'Християнски песни за хваление и поклонение'},
                {name: "keywords", content: "християнски, песни, хваление, поклонение, бог, библия, християнство, християни, акорди, музика, текст, текст на песни, текстове, евангелски песни"}
            ],
            navbar: {
                title: 'Песни',
                // logo: {
                //   alt: 'My Site Logo',
                //   src: 'img/logo.svg',
                // },
                items: [
                    //   {
                    //     type: 'doc',
                    //     docId: 'intro',
                    //     position: 'left',
                    //     label: 'Песни',
                    //   },
                    {
                        href: 'https://propovedi.org/',
                        label: 'ProPoVedi',
                        position: 'right',
                    },
                    {
                        href: 'https://propovedi.org/pesnarka/',
                        label: 'Песнарка',
                        position: 'right',
                    },
                    {
                        href: 'https://github.com/Rinto-kun/pesni',
                        position: 'right',
                        className: 'header-github-link',
                        'aria-label': 'GitHub repository',
                    },
                ],
            },
            // footer: {
            //   style: 'dark',
            //   links: [
            //     {
            //       title: 'Docs',
            //       items: [
            //         {
            //           label: 'Tutorial',
            //           to: '/docs/intro',
            //         },
            //       ],
            //     },
            //     {
            //       title: 'Community',
            //       items: [
            //         {
            //           label: 'Stack Overflow',
            //           href: 'https://stackoverflow.com/questions/tagged/docusaurus',
            //         },
            //         {
            //           label: 'Discord',
            //           href: 'https://discordapp.com/invite/docusaurus',
            //         },
            //         {
            //           label: 'Twitter',
            //           href: 'https://twitter.com/docusaurus',
            //         },
            //       ],
            //     },
            //     {
            //       title: 'More',
            //       items: [
            //         {
            //           label: 'Blog',
            //           to: '/blog',
            //         },
            //         {
            //           label: 'GitHub',
            //           href: 'https://github.com/facebook/docusaurus',
            //         },
            //       ],
            //     },
            //   ],
            //   copyright: `Copyright © ${new Date().getFullYear()} My Project, Inc. Built with Docusaurus.`,
            // },
            prism: {
                theme: lightCodeTheme,
                darkTheme: darkCodeTheme,
            },
        }),
    plugins: [
        // [
            // require.resolve("@cmfcmf/docusaurus-search-local"),
            // {
            //     // whether to index docs pages
            //     indexDocs: true,

            //     // Whether to also index the titles of the parent categories in the sidebar of a doc page.
            //     // 0 disables this feature.
            //     // 1 indexes the direct parent category in the sidebar of a doc page
            //     // 2 indexes up to two nested parent categories of a doc page
            //     // 3...
            //     //
            //     // Do _not_ use Infinity, the value must be a JSON-serializable integer.
            //     indexDocSidebarParentCategories: 0,

            //     // whether to index blog pages
            //     indexBlog: false,

            //     // whether to index static pages
            //     // /404.html is never indexed
            //     indexPages: false,

            //     // language of your documentation, see next section
            //     language: "ru",

            //     // setting this to "none" will prevent the default CSS to be included. The default CSS
            //     // comes from autocomplete-theme-classic, which you can read more about here:
            //     // https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-theme-classic/
            //     // When you want to overwrite CSS variables defined by the default theme, make sure to suffix your
            //     // overwrites with `!important`, because they might otherwise not be applied as expected. See the
            //     // following comment for more information: https://github.com/cmfcmf/docusaurus-search-local/issues/107#issuecomment-1119831938.
            //     style: undefined,

            //     // The maximum number of search results shown to the user. This does _not_ affect performance of
            //     // searches, but simply does not display additional search results that have been found.
            //     maxSearchResults: 8,

            //     // lunr.js-specific settings
            //     lunr: {
            //       // When indexing your documents, their content is split into "tokens".
            //       // Text entered into the search box is also tokenized.
            //       // This setting configures the separator used to determine where to split the text into tokens.
            //       // By default, it splits the text at whitespace and dashes.
            //       //
            //       // Note: Does not work for "ja" and "th" languages, since these use a different tokenizer.
            //       tokenizerSeparator: /[\s\-]+/,
            //       // https://lunrjs.com/guides/customising.html#similarity-tuning
            //       //
            //       // This parameter controls the importance given to the length of a document and its fields. This
            //       // value must be between 0 and 1, and by default it has a value of 0.75. Reducing this value
            //       // reduces the effect of different length documents on a term’s importance to that document.
            //       b: 0.75,
            //       // This controls how quickly the boost given by a common word reaches saturation. Increasing it
            //       // will slow down the rate of saturation and lower values result in quicker saturation. The
            //       // default value is 1.2. If the collection of documents being indexed have high occurrences
            //       // of words that are not covered by a stop word filter, these words can quickly dominate any
            //       // similarity calculation. In these cases, this value can be reduced to get more balanced results.
            //       k1: 1.2,
            //       // By default, we rank pages where the search term appears in the title higher than pages where
            //       // the search term appears in just the text. This is done by "boosting" title matches with a
            //       // higher value than content matches. The concrete boosting behavior can be controlled by changing
            //       // the following settings.
            //       titleBoost: 5,
            //       contentBoost: 1,
            //       tagsBoost: 3,
            //       parentCategoriesBoost: 2, // Only used when indexDocSidebarParentCategories > 0
            //     }
            //   }
        // ],
        async function loadFontSettings(context,options){
            return{
                name: 'load-font-settings',
                injectHtmlTags({content}){
                    return {
                        preBodyTags:[
                            {
                                tagName: 'script',
                                innerHTML: `function loadFontSettingsFromLocalStorage(){
                                        const doc = document.querySelector(":root");
                                        const storage = window.localStorage;
                                        doc.style.setProperty("--custom-line-height",storage.getItem("lineHeight"));
                                        doc.style.setProperty("--custom-font-weight",storage.getItem("fontWeight"));
                                        doc.style.setProperty("--custom-font-factor",storage.getItem("fontSizeFactor"));
                                    }
                                    loadFontSettingsFromLocalStorage();
                                    `
                            }
                        ]

                    }
                }
                
            }
        }
        
    ],
    themes:[
        [
            // The search is implemented as a theme rather than plugin.
            require.resolve("@easyops-cn/docusaurus-search-local"),
            {
              // ... Your options.
              // `hashed` is recommended as long-term-cache of index file is possible.
              indexBlog:false,
              docsRouteBasePath: '/',
              hashed: true,
              // Selecting Russian as there is no Bulgarian.
              language: ["ru"],
              highlightSearchTermsOnTargetPage:false,
            },
        ]
    ]
};

module.exports = config;

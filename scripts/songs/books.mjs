// The songbooks on the site. Each one is a folder of ChordPro files and a tab
// with its own docs instance (docusaurus.config.js), sidebar and search index.
//
//   id        name in paths: src/data/<id>/, typ/generated/<id>/, static/cho/<id>/, static/openlp/<id>/
//   label     tab and sidebar title, OpenLP songbook name
//   songs     source folder of NNN-slug.cho files
//   docs      generated docs folder for the instance
//   route     URL prefix ('' = the site root)
//   intro     optional text for the book's index page
//   links     optional extra entries for the index page and sidebar: [{label, href}]
export const BOOKS = [
    {
        id: 'pesni',
        label: 'Песни',
        songs: 'songs',
        docs: 'docs',
        route: '',
    },
    {
        id: 'rozhdestvo',
        label: 'Рождество',
        songs: 'books/rozhdestvo',
        docs: 'docs-rozhdestvo',
        route: 'pesni-rozhdestvo',
        intro: 'Рождествени песни от по-новите и от Песнарката.',
        links: [
            {label: '313. НАМ СЕ РОДИ ЕДНО ДЕТЕ', href: 'https://propovedi.org/pesnarka/313'},
            {label: '314. ТИХА НОЩ', href: 'https://propovedi.org/pesnarka/314'},
            {label: '315. О, ЧУДНА, СЛАВНА, СВЯТА НОЩ', href: 'https://propovedi.org/pesnarka/315'},
            {label: '316. СЛАВА ВО ВИШНИХ', href: 'https://propovedi.org/pesnarka/316'},
            {label: '318. ЧУЙТЕ АНГЕЛСКИЯ ГЛАС', href: 'https://propovedi.org/pesnarka/318'},
            {label: '594. ЕДНА ЗВЕЗДА В ПРОСТОРА СВЕТИ', href: 'https://propovedi.org/pesnarka/594'},
        ],
    },
];

// Песни keeps the paths it had before there were several books (docs/052.md,
// src/data/songs/, /pdf/, /chords/, static/openlp/*.xml); the other books get
// their own folder everywhere.
export function bookPaths(book) {
    const main = book.id === 'pesni';
    const prefix = book.route ? `/${book.route}` : '';
    return {
        main,
        docId: (number) => (main ? String(number).padStart(3, '0') : String(number)),
        pageUrl: (number) => (main ? `/${String(number).padStart(3, '0')}/` : `${prefix}/${number}/`),
        data: main ? 'src/data/songs' : `src/data/${book.id}`,
        dataImport: (id) => `@site/${main ? 'src/data/songs' : `src/data/${book.id}`}/${id}.json`,
        typ: main ? 'typ/generated' : `typ/generated/${book.id}`,
        pdf: `${prefix}/pdf`,
        chords: `${prefix}/chords`,
        cho: main ? '' : `${book.id}/`,
        openlp: main ? 'static/openlp' : `static/openlp/${book.id}`,
        zip: main ? 'static/openlp/pesni-openlp.zip' : `static/openlp/${book.id}-openlp.zip`,
        sidebar: `src/data/sidebars/${book.id}.json`,
    };
}

import ComponentTypes from '@theme-original/NavbarItem/ComponentTypes';
import PaletteMenu from '@site/src/components/PaletteMenu';

// Docusaurus' navbar item types plus the palette menu ({type: 'custom-paletteMenu'}).
export default {
    ...ComponentTypes,
    'custom-paletteMenu': PaletteMenu,
};

import React from 'react';
// Import the original mapper
import MDXComponents from '@theme-original/MDXComponents';
// import Highlight from '@site/src/components/Highlight';
import {DownloadsButton, DownloadChordsButton} from '@site/src/components/DownloadsButton';
import ChordSheet from '@site/src/components/ChordSheet';

export default {
  // Re-use the default mapping
  ...MDXComponents,
  DownloadsButton,
  DownloadChordsButton,
  ChordSheet,
  // Map the "highlight" tag to our <Highlight /> component!
  // `Highlight` will receive all props that were passed to `highlight` in MDX
//   chords: Chords,
};
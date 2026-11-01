import React from 'react';
import DocBreadcrumbs from '@theme-original/DocBreadcrumbs';
import useIsBrowser from '@docusaurus/useIsBrowser';
import FontControlButtons from './FontControlButtons';
import ChordControls from './ChordControls';
import styles from './styles.module.css';

// Docusaurus' breadcrumbs with the song's menus beside them: chords (on songs with
// chords) and text size, weight and spacing.
export default function DocBreadcrumbsWrapper(props) {
    const isBrowser = useIsBrowser();
    return (
        <div className={styles.pageTools}>
            <div className={styles.crumbs}>
                <DocBreadcrumbs {...props} />
            </div>
            {isBrowser && (
                <div className={styles.menus}>
                    <ChordControls />
                    <FontControlButtons />
                </div>
            )}
        </div>
    );
}

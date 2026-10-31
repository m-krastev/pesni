import React from 'react';
import DocBreadcrumbs from '@theme-original/DocBreadcrumbs';
import useIsBrowser from '@docusaurus/useIsBrowser';
import FontControlButtons from './FontControlButtons';
import styles from './styles.module.css';

// Docusaurus' breadcrumbs with the font size / weight / line height controls beside them.
export default function DocBreadcrumbsWrapper(props) {
    return (
        <div className={styles.breadcrumbsContainer}>
            <DocBreadcrumbs {...props} />
            {useIsBrowser() && <FontControlButtons />}
        </div>
    );
}

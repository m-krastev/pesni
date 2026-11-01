import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import {filterDocCardListItems, useCurrentSidebarSiblings, useDocById} from '@docusaurus/plugin-content-docs/client';
import styles from './styles.module.css';

// The song lists of the category pages (Песни 1-50, ...): a compact list of
// titles with their first lines, instead of Docusaurus' cards.
function Entry({item}) {
    const doc = useDocById(item.type === 'link' ? item.docId ?? undefined : undefined);
    const href = item.href;
    return (
        <li>
            <Link to={href} className={styles.entry}>
                <span className={styles.title}>{item.label}</span>
                {doc && doc.description && <span className={styles.firstLine}>{doc.description}</span>}
            </Link>
        </li>
    );
}

function CurrentCategory({className}) {
    return <DocCardList items={useCurrentSidebarSiblings()} className={className} />;
}

export default function DocCardList({items, className}) {
    if (!items) return <CurrentCategory className={className} />;
    return (
        <ul className={clsx(styles.list, className)}>
            {filterDocCardListItems(items).map((item, index) => <Entry key={index} item={item} />)}
        </ul>
    );
}

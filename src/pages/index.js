import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import books from '@site/src/data/books.json';
import styles from './index.module.css';

const HOME = {pesni: '/1-50/'};

// Opens the search box in the navbar.
function openSearch() {
    const input = document.querySelector('.navbar__search-input');
    if (input) input.focus();
    else document.querySelector('.navbar__search button, [aria-label="Search"]')?.click();
}

export default function Home() {
    const total = books.reduce((sum, book) => sum + book.count, 0);
    return (
        <Layout title="Песни за хваление и поклонение" description="Християнски песни с текст, акорди, ноти и записи.">
            <main className={styles.home}>
                <header className={styles.hero}>
                    <h1>Песни за хваление и поклонение</h1>
                    <p>{total.toLocaleString('bg')} песни с текст и акорди: за пеене в църква, за подготовка на хваление и за прожектиране в OpenLP.</p>
                    <button type="button" className={styles.search} onClick={openSearch}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3m0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10" /></svg>
                        Търсене по заглавие или текст
                    </button>
                </header>
                <section className={styles.books} aria-label="Сборници">
                    {books.map((book) => (
                        <Link key={book.id} to={HOME[book.id] || `/${book.route}/`} className={styles.book}>
                            <span className={styles.count}>{book.count}</span>
                            <h2>{book.label}</h2>
                            <p>{book.intro}</p>
                        </Link>
                    ))}
                </section>
                <section className={styles.notes}>
                    <div>
                        <h3>Акорди</h3>
                        <p>Включете ги от менюто „Акорди“ на песента. Там песента се транспонира, а „Схеми“ показва как се хваща всеки акорд.</p>
                    </div>
                    <div>
                        <h3>Отпечатване и OpenLP</h3>
                        <p>Всяка песен има PDF с текста и с акордите. Всички песни за OpenLP: <a href="/openlp/pesni-openlp.zip">Песни</a>, <a href="/openlp/rozhdestvo-openlp.zip">Рождество</a>, <a href="/openlp/pesnarka-openlp.zip">Песнарка</a>, <a href="/openlp/new-openlp.zip">Нови</a>.</p>
                    </div>
                    <div>
                        <h3>Поправки</h3>
                        <p>Видите ли грешка в текста или акордите, натиснете „Предложи корекция“ под песента.</p>
                    </div>
                </section>
            </main>
        </Layout>
    );
}

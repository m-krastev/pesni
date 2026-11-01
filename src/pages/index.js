import React, {useState} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import {useHistory} from '@docusaurus/router';
import books from '@site/src/data/books.json';
import styles from './index.module.css';

// Песни starts with its first range of 50; the other books with their index page.
const bookHome = (book) => (book.route ? `/${book.route}/` : '/1-50/');
const songUrl = (book, number) => (book.route ? `/${book.route}/${number}/` : `/${String(number).padStart(3, '0')}/`);

// Opens a song by its number in the chosen book.
function OpenByNumber() {
    const history = useHistory();
    const [bookId, setBookId] = useState(books[0].id);
    const [number, setNumber] = useState('');
    const [missing, setMissing] = useState(false);
    const book = books.find((b) => b.id === bookId);
    const open = (event) => {
        event.preventDefault();
        const n = parseInt(number, 10);
        if (book.numbers.includes(n)) history.push(songUrl(book, n));
        else setMissing(true);
    };
    return (
        <form className={styles.open} onSubmit={open}>
            <label htmlFor="song-number">Песен №</label>
            <input id="song-number" type="number" inputMode="numeric" min="1" value={number} autoFocus
                onChange={(e) => {
                    setNumber(e.target.value);
                    setMissing(false);
                }} />
            <select aria-label="Сборник" value={bookId} onChange={(e) => {
                setBookId(e.target.value);
                setMissing(false);
            }}>
                {books.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
            <button type="submit">Отвори</button>
            {missing && <span className={styles.missing}>В {book.label} няма песен {number}.</span>}
        </form>
    );
}

export default function Home() {
    return (
        <Layout title="Песни" description="Християнски песни за хваление и поклонение: текст, акорди, ноти и записи.">
            <main className={styles.home}>
                <h1>Песни за хваление и поклонение</h1>
                <OpenByNumber />
                <table className={styles.books}>
                    <thead>
                        <tr>
                            <th>Сборник</th>
                            <th className={styles.count}>Песни</th>
                            <th>Съдържание</th>
                            <th>OpenLP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {books.map((book) => (
                            <tr key={book.id}>
                                <th scope="row"><Link to={bookHome(book)}>{book.label}</Link></th>
                                <td className={styles.count}>{book.count}</td>
                                <td>{book.intro}</td>
                                <td><a href={book.zip} download>zip</a></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className={styles.footnote}>
                    Акордите, транспонирането и схемите са в менюто над всяка песен. Грешка в песен? „Предложи корекция“ е под нея.
                </p>
            </main>
        </Layout>
    );
}

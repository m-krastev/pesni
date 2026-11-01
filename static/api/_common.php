<?php
// Shared by suggest.php (saves suggestions from the song pages) and
// suggestions.php (the review page). Data and settings live outside the web
// root, next to the site folder:
//
//   pesni-suggest-data/suggestions.sqlite   the suggestions (created on first use)
//   pesni-suggest-config.php                optional settings, see README:
//       <?php return ['admin_password_hash' => '$2y$...', 'dsn' => 'sqlite:...'];
declare(strict_types=1);

const HOME_DIR = __DIR__ . '/../..';
const DATA_DIR = HOME_DIR . '/pesni-suggest-data';
const SONG_SOURCES = __DIR__ . '/../cho';

function config(): array
{
    static $config = null;
    if ($config === null) {
        $file = HOME_DIR . '/pesni-suggest-config.php';
        $loaded = is_file($file) ? require $file : [];
        $config = is_array($loaded) ? $loaded : [];
    }
    return $config;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    $dsn = config()['dsn'] ?? null;
    if ($dsn === null) {
        if (!is_dir(DATA_DIR) && !mkdir(DATA_DIR, 0700, true) && !is_dir(DATA_DIR)) {
            throw new RuntimeException('cannot create ' . DATA_DIR);
        }
        $dsn = 'sqlite:' . DATA_DIR . '/suggestions.sqlite';
    }
    $pdo = new PDO($dsn, config()['db_user'] ?? null, config()['db_password'] ?? null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $id = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql'
        ? 'INTEGER PRIMARY KEY AUTO_INCREMENT' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    $pdo->exec("CREATE TABLE IF NOT EXISTS suggestions (
        id $id,
        created_at VARCHAR(20) NOT NULL,
        song VARCHAR(100) NOT NULL,
        text TEXT NOT NULL,
        original TEXT NOT NULL,
        outdated INTEGER NOT NULL DEFAULT 0,
        name VARCHAR(100) NOT NULL DEFAULT '',
        note TEXT NOT NULL,
        sender VARCHAR(64) NOT NULL,
        status VARCHAR(10) NOT NULL DEFAULT 'new'
    )");
    return $pdo;
}

/** The song's source as the site has it now (build copies songs/*.cho to /cho/), or null. */
function currentSource(string $file): ?string
{
    if (!preg_match('~^(?:[a-z]+/)?\d{3}-[a-z0-9-]+\.cho$~', $file)) {
        return null;
    }
    $path = SONG_SOURCES . '/' . $file;
    return is_file($path) ? (string) file_get_contents($path) : null;
}

/** The song's page on the site: songs at the root are /NNN/, other books /<route>/N/ (static/cho/books.json). */
function songUrl(string $file): string
{
    $book = strpos($file, '/') !== false ? strstr($file, '/', true) : '';
    $routes = json_decode((string) @file_get_contents(SONG_SOURCES . '/books.json'), true) ?: [];
    $number = substr(basename($file), 0, 3);
    $route = $routes[$book] ?? '';
    return $route === '' ? "/$number/" : "/$route/" . (int) $number . '/';
}

function h(string $text): string
{
    return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

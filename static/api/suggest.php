<?php
// Receives a correction from the "Предложи корекция" editor on a song page
// (src/components/SuggestEdit) and saves it for review on suggestions.php.
// Nothing on the site changes until someone applies it to songs/*.cho.
declare(strict_types=1);

require __DIR__ . '/_common.php';

const MAX_SOURCE = 20000;
const MAX_NOTE = 2000;
const MAX_NAME = 100;
const PER_SENDER_PER_HOUR = 5;
const PER_DAY = 50;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function reply(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    reply(405, ['error' => 'Само POST.']);
}

$input = json_decode((string) file_get_contents('php://input', false, null, 0, 64 * 1024), true);
if (!is_array($input)) {
    reply(400, ['error' => 'Невалидна заявка.']);
}
$field = function (string $key) use ($input): string {
    $value = $input[$key] ?? '';
    return is_string($value) ? str_replace("\r\n", "\n", $value) : '';
};
$file = $field('file');
$text = $field('text');
$original = $field('original');
$name = trim(preg_replace('/\s+/u', ' ', $field('name')));
$note = trim($field('note'));

// People never see this field; bots fill it in. Pretend it worked.
if ($field('website') !== '') {
    reply(200, ['ok' => true]);
}
$current = currentSource($file);
if ($current === null) {
    reply(400, ['error' => 'Няма такава песен.']);
}
if (!mb_check_encoding($text . $original . $note . $name, 'UTF-8') || trim($text) === ''
    || strlen($text) > MAX_SOURCE || strlen($original) > MAX_SOURCE
    || mb_strlen($note) > MAX_NOTE || mb_strlen($name) > MAX_NAME) {
    reply(400, ['error' => 'Текстът е празен или твърде дълъг.']);
}
if (substr($text, -1) !== "\n") {
    $text .= "\n";
}
if ($text === $original || $text === $current) {
    reply(400, ['error' => 'Няма промени.']);
}

try {
    $db = db();
    $sender = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . __DIR__);
    $mine = $db->prepare('SELECT COUNT(*) FROM suggestions WHERE created_at > ? AND sender = ?');
    $mine->execute([gmdate('Y-m-d H:i:s', time() - 3600), $sender]);
    $today = $db->prepare('SELECT COUNT(*) FROM suggestions WHERE created_at > ?');
    $today->execute([gmdate('Y-m-d H:i:s', time() - 86400)]);
    [$mine, $today] = [(int) $mine->fetchColumn(), (int) $today->fetchColumn()];
    if ($mine >= PER_SENDER_PER_HOUR || $today >= PER_DAY) {
        reply(429, ['error' => 'Твърде много предложения за кратко време. Опитайте пак по-късно.']);
    }
    $db->prepare('INSERT INTO suggestions (created_at, song, text, original, outdated, name, note, sender)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([gmdate('Y-m-d H:i:s'), $file, $text, $original, (int) ($original !== $current), $name, $note, $sender]);
} catch (Throwable $e) {
    error_log('pesni suggest: ' . $e->getMessage());
    reply(503, ['error' => 'Предложението не можа да се запише. Опитайте пак по-късно.']);
}

reply(200, ['ok' => true]);

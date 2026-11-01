<?php
// Review page for corrections sent from the song pages (suggest.php). Shows
// each suggestion as a diff against the song as the site has it now, with the
// full proposed .cho to download. Applying one means copying it into songs/ in
// the repository; mark it done or rejected here afterwards.
//
// Needs `admin_password_hash` in pesni-suggest-config.php (see README).
declare(strict_types=1);

require __DIR__ . '/_common.php';

header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');
session_set_cookie_params(['path' => dirname($_SERVER['SCRIPT_NAME']), 'secure' => !empty($_SERVER['HTTPS']), 'httponly' => true, 'samesite' => 'Strict']);
session_start();

$hash = config()['admin_password_hash'] ?? '';
$loggedIn = !empty($_SESSION['admin']);

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
    if ($hash !== '' && password_verify((string) $_POST['password'], $hash)) {
        session_regenerate_id(true);
        $_SESSION['admin'] = true;
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    } else {
        sleep(2);
    }
    header('Location: ' . $_SERVER['SCRIPT_NAME']);
    exit;
}

if ($loggedIn && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $status = $_POST['status'] ?? '';
    if (hash_equals($_SESSION['csrf'] ?? '', (string) ($_POST['csrf'] ?? '')) && in_array($status, ['new', 'done', 'rejected'], true)) {
        db()->prepare('UPDATE suggestions SET status = ? WHERE id = ?')->execute([$status, (int) ($_POST['id'] ?? 0)]);
    }
    header('Location: ' . $_SERVER['SCRIPT_NAME'] . (isset($_GET['all']) ? '?all' : ''));
    exit;
}

if ($loggedIn && isset($_GET['download'])) {
    $row = db()->prepare('SELECT song, text FROM suggestions WHERE id = ?');
    $row->execute([(int) $_GET['download']]);
    $suggestion = $row->fetch();
    if ($suggestion) {
        header('Content-Type: text/plain; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $suggestion['song'] . '"');
        echo $suggestion['text'];
        exit;
    }
}

/** Line diff (longest common subsequence): a list of [' ' | '-' | '+', line]. */
function diffLines(string $old, string $new): array
{
    $a = explode("\n", rtrim($old, "\n"));
    $b = explode("\n", rtrim($new, "\n"));
    $n = count($a);
    $m = count($b);
    $lcs = array_fill(0, $n + 1, array_fill(0, $m + 1, 0));
    for ($i = $n - 1; $i >= 0; $i--) {
        for ($j = $m - 1; $j >= 0; $j--) {
            $lcs[$i][$j] = $a[$i] === $b[$j] ? $lcs[$i + 1][$j + 1] + 1 : max($lcs[$i + 1][$j], $lcs[$i][$j + 1]);
        }
    }
    $out = [];
    for ($i = 0, $j = 0; $i < $n || $j < $m;) {
        if ($i < $n && $j < $m && $a[$i] === $b[$j]) {
            $out[] = [' ', $a[$i++]];
            $j++;
        } elseif ($i < $n && ($j === $m || $lcs[$i + 1][$j] >= $lcs[$i][$j + 1])) {
            $out[] = ['-', $a[$i++]];
        } else {
            $out[] = ['+', $b[$j++]];
        }
    }
    return $out;
}

/** The changed lines with two lines of context around them. */
function renderDiff(array $diff): string
{
    $show = [];
    foreach ($diff as $k => [$op]) {
        if ($op !== ' ') {
            for ($c = max(0, $k - 2); $c <= min(count($diff) - 1, $k + 2); $c++) {
                $show[$c] = true;
            }
        }
    }
    $html = '';
    $last = -1;
    foreach ($diff as $k => [$op, $line]) {
        if (empty($show[$k])) {
            continue;
        }
        if ($last !== -1 && $k !== $last + 1) {
            $html .= "<span class=\"gap\">…</span>\n";
        }
        $class = ['+' => 'add', '-' => 'del', ' ' => 'ctx'][$op];
        $html .= "<span class=\"$class\">" . $op . ' ' . h($line) . "</span>\n";
        $last = $k;
    }
    return $html;
}

?><!doctype html>
<html lang="bg">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Предложения</title>
<style>
:root { color-scheme: light dark; --add: #e6ffec; --del: #ffebe9; --muted: #666; --line: #ddd; }
@media (prefers-color-scheme: dark) { :root { --add: #12361f; --del: #3d1618; --muted: #aaa; --line: #444; } }
body { font: 16px/1.5 system-ui, sans-serif; max-width: 60rem; margin: 0 auto; padding: 1rem; }
article { border: 1px solid var(--line); border-radius: 6px; padding: 1rem; margin: 1rem 0; }
h1 { font-size: 1.5rem; } h2 { font-size: 1.1rem; margin: 0 0 .25rem; }
.meta { color: var(--muted); font-size: .9rem; }
.warn { color: #b35900; font-weight: 600; }
blockquote { margin: .5rem 0; padding-left: .75rem; border-left: 3px solid var(--line); white-space: pre-wrap; }
pre { overflow-x: auto; font-size: .85rem; line-height: 1.4; }
pre span { display: block; white-space: pre; } .add { background: var(--add); } .del { background: var(--del); }
.ctx, .gap { color: var(--muted); }
form { display: inline; } button { font: inherit; margin-right: .5rem; }
</style>
</head>
<body>
<h1>Предложения за корекции</h1>
<?php if ($hash === ''): ?>
<p>Страницата не е настроена: добавете <code>admin_password_hash</code> в <code>pesni-suggest-config.php</code> (вижте README).</p>
<?php elseif (!$loggedIn): ?>
<form method="post"><label>Парола <input type="password" name="password" autofocus></label> <button>Вход</button></form>
<?php else:
    $all = isset($_GET['all']);
    $rows = db()->query('SELECT * FROM suggestions' . ($all ? '' : " WHERE status = 'new'") . ' ORDER BY id DESC')->fetchAll();
    $labels = ['new' => 'ново', 'done' => 'приложено', 'rejected' => 'отхвърлено'];
?>
<p><?= $all ? '<a href="?">Само новите</a>' : '<a href="?all">Всички, и прегледаните</a>' ?> · <?= count($rows) ?> предложения</p>
<?php if (!$rows): ?><p>Няма нови предложения.</p><?php endif; ?>
<?php foreach ($rows as $s):
    $number = (int) $s['song'];
    $current = currentSource($s['song']);
?>
<article>
  <h2><a href="/<?= h(substr($s['song'], 0, 3)) ?>/" target="_blank"><?= $number ?>. <?= h($s['song']) ?></a> · #<?= (int) $s['id'] ?> · <?= h($labels[$s['status']] ?? $s['status']) ?></h2>
  <div class="meta"><?= h($s['created_at']) ?> UTC · <?= $s['name'] !== '' ? h($s['name']) : 'без име' ?></div>
  <?php if ($s['note'] !== ''): ?><blockquote><?= h($s['note']) ?></blockquote><?php endif; ?>
  <?php if ((int) $s['outdated']): ?><p class="warn">Направено върху по-стара версия на песента: внимавайте да не върнете по-нови поправки.</p><?php endif; ?>
  <?php if ($current === null): ?>
    <p class="warn">Песента вече я няма на сайта.</p>
  <?php elseif ($current === $s['text']): ?>
    <p class="meta">Песента на сайта вече е точно такава.</p>
  <?php else: ?>
    <pre><?= renderDiff(diffLines($current, $s['text'])) ?></pre>
  <?php endif; ?>
  <a href="?download=<?= (int) $s['id'] ?>">Изтегли <?= h($s['song']) ?></a>
  <div style="margin-top:.5rem">
  <?php foreach (['done' => 'Приложено', 'rejected' => 'Отхвърли', 'new' => 'Върни като ново'] as $status => $label):
      if ($status === $s['status']) continue; ?>
    <form method="post"<?= $all ? ' action="?all"' : '' ?>>
      <input type="hidden" name="csrf" value="<?= h($_SESSION['csrf']) ?>">
      <input type="hidden" name="id" value="<?= (int) $s['id'] ?>">
      <button name="status" value="<?= $status ?>"><?= $label ?></button>
    </form>
  <?php endforeach; ?>
  </div>
</article>
<?php endforeach; endif; ?>
</body>
</html>

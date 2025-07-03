import esbuild from 'esbuild';
import fs from 'fs';
import { promisify } from 'util';

const copyFile = promisify(fs.copyFile);
const rm = promisify(fs.rm);
const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const build = async () => {
  try {
    // 🔥 Очистка предыдущей сборки
    if (fs.existsSync('dist')) {
      await rm('dist', { recursive: true, force: true });
    }
    
    // Создаем папки
    await mkdir('dist', { recursive: true });
    await mkdir('dist/assets', { recursive: true });
    await mkdir('dist/vendors', { recursive: true });

    // Копируем статические ресурсы
    if (fs.existsSync('assets')) {
      fs.cpSync('assets', 'dist/assets', { recursive: true });
    }
    
    // Копируем ВСЕ вендорные файлы без обработки
    if (fs.existsSync('vendors')) {
      fs.cpSync('vendors', 'dist/vendors', { recursive: true });
    }

    // Копируем шрифты
    if (fs.existsSync('lato.woff2')) {
      await copyFile('lato.woff2', 'dist/lato.woff2');
    }

    // Обрабатываем HTML
    let html = await readFile('index.html', 'utf-8');
    
    // Извлекаем скрипт
    const scriptStart = html.indexOf('<script type="text/babel">') + 27;
    const scriptEnd = html.indexOf('</script>', scriptStart);
    const scriptContent = html.substring(scriptStart, scriptEnd).trim();
    
    await mkdir('src', { recursive: true });
    await writeFile('src/app.js', scriptContent);
    
    // Удаляем старые скрипты
    html = html.replace(
      /<script type="text\/babel">[\s\S]*?<\/script>/,
      ''
    );
    html = html.replace(
      '<script src="vendors/babel.min.js"></script>',
      ''
    );
    
    // Заменяем на CDN-версию React (уже минифицированную)
    html = html.replace(
      '<script src="vendors/react-with-dom.js"></script>',
      `<script src="https://unpkg.com/react@18.2.0/umd/react.production.min.js"></script>
       <script src="https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js"></script>`
    );
    
    // Добавляем новый скрипт и preload
    html = html.replace(
      '</title>',
      `</title>
       <link rel="preload" href="./bundle.min.js" as="script">
       <link rel="preload" href="./styles.min.css" as="style">
       <link rel="preload" href="./lato.woff2" as="font" crossorigin>`
    );
    
    html = html.replace(
      '</body>',
      '<script src="./bundle.min.js"></script></body>'
    );
    
    // Обновляем пути CSS
    html = html.replace(
      'href="reset.css"',
      'href="./reset.min.css"'
    );
    html = html.replace(
      'href="styles.css"',
      'href="./styles.min.css"'
    );
    
    // Обновляем путь к шрифту
    html = html.replace(
      'href="assets/lato.woff2"',
      'href="./lato.woff2"'
    );
    
    await writeFile('dist/index.html', html);

    // Собираем JS приложения
    await esbuild.build({
      entryPoints: ['src/app.js'],
      bundle: true,
      minify: true,
      treeShaking: true,
      outfile: 'dist/bundle.min.js',
      loader: {
        '.js': 'jsx'
      },
      define: {
        'process.env.NODE_ENV': '"production"'
      },
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment'
    });

    // Собираем CSS
    await esbuild.build({
      entryPoints: ['reset.css'],
      minify: true,
      outfile: 'dist/reset.min.css',
      loader: { '.css': 'css' }
    });

    await esbuild.build({
      entryPoints: ['styles.css'],
      minify: true,
      outfile: 'dist/styles.min.css',
      loader: { '.css': 'css' }
    });

    console.log('✅ Сборка успешна! Откройте dist/index.html');
    
    // Дополнительные рекомендации
    console.log(`
    Дополнительные оптимизации:
    1. Конвертируйте изображения в WebP:
       npx @squoosh/cli --webp '{"quality":65}' dist/assets/*.png
    
    2. Оптимизируйте SVG:
       npx svgo dist/assets/*.svg
       
    3. Проверьте размеры сборки:
       du -sh dist/* | sort -hr
    `);
  } catch (e) {
    console.error('❌ Ошибка сборки:', e);
    process.exit(1);
  }
};

build();
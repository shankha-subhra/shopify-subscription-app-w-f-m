import selfsigned from 'selfsigned';
import fs from 'fs';
import path from 'path';

const attrs = [{ name: 'commonName', value: 'localhost' }];
async function run() {
  const pems = selfsigned.generate(attrs, { days: 365, keySize: 2048 });

const shopifyDir = path.join(process.cwd(), '.shopify');

if (!fs.existsSync(shopifyDir)) {
  fs.mkdirSync(shopifyDir, { recursive: true });
}

console.log(Object.keys(pems));
  fs.writeFileSync(path.join(shopifyDir, 'localhost.pem'), pems.cert || pems.certificate);
  fs.writeFileSync(path.join(shopifyDir, 'localhost-key.pem'), pems.private);

  console.log('Successfully generated SSL certificates in .shopify/ directory!');
}
run();

const fs = require('node:fs');
const path = require('node:path');

const COMPANY_FILE = 'minha-empresa.md';
const CLIENTS_DIR = 'clientes';
const COMPANY_TEMPLATE = `# Minha empresa

Escreva aqui o que você vende, para quem, como cobra e as provas que pode citar.
O Coach usa este texto em todas as calls. Só cite o que for verdade: ele não inventa fatos.
`;
const CLIENT_TEMPLATE = `# Exemplo de cliente

Crie um arquivo .md por cliente nesta pasta e escolha na barra antes da call.

- Quem está na call e o cargo de cada pessoa
- O que a empresa faz
- O que já foi conversado
- O objetivo desta call
`;

function ensureContexts(root) {
  fs.mkdirSync(path.join(root, CLIENTS_DIR), { recursive: true });
  const company = path.join(root, COMPANY_FILE);
  if (!fs.existsSync(company)) {
    fs.writeFileSync(company, COMPANY_TEMPLATE);
    fs.writeFileSync(path.join(root, CLIENTS_DIR, 'exemplo.md'), CLIENT_TEMPLATE);
  }
}

function listClients(root) {
  return fs
    .readdirSync(path.join(root, CLIENTS_DIR))
    .filter((name) => name.toLowerCase().endsWith('.md'))
    .map((name) => name.slice(0, -3))
    .sort((a, b) => a.localeCompare(b));
}

function readContext(root, client) {
  const company = fs.readFileSync(path.join(root, COMPANY_FILE), 'utf8');
  if (!client) return { company, client: '' };
  // The name comes from the screen, so keep it inside the clients folder.
  const file = path.join(root, CLIENTS_DIR, `${path.basename(client)}.md`);
  return { company, client: fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '' };
}

module.exports = { ensureContexts, listClients, readContext };

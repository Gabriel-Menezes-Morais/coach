# Coach

Uma barra de 880 pixels no topo da tela do Windows. Ela ouve a call pelo próprio notebook, transcreve em tempo real e escreve a próxima frase que você deve dizer, usando o que você sabe sobre o cliente.

Não entra bot na reunião. Funciona com Google Meet, Zoom, Teams ou qualquer programa que toque som no computador.

## Instalar

[Baixar o instalador para Windows](https://github.com/Gabriel-Menezes-Morais/coach/releases/latest/download/Coach-Setup.exe)

O instalador não tem assinatura digital, então o Windows avisa na primeira vez. Clique em **Mais informações** e depois em **Executar assim mesmo**.

## Configurar

Você precisa de duas chaves, uma para ouvir e outra para escrever.

1. Crie uma chave no [ElevenLabs](https://elevenlabs.io/app/settings/api-keys). Ela faz a transcrição.
2. Crie uma chave na [Anthropic](https://platform.claude.com/settings/keys). Ela paga o Claude.
3. Abra o Coach e clique em **Ajustes**.
4. Cole as duas chaves e clique em **Salvar**.

As chaves ficam criptografadas na sua conta do Windows e nunca saem do seu computador, a não ser para falar com esses dois serviços.

## Contar quem é o cliente

Clique em **Ajustes** e depois em **Abrir pasta de contextos**. A pasta fica em `Documentos\Coach`.

- `minha-empresa.md`: o que você vende, para quem, como cobra e o que pode provar. Vale para todas as calls.
- `clientes\nome-do-cliente.md`: um arquivo por cliente, com quem estará na call, o que já foi conversado e o objetivo.

O Coach só cita fatos que estejam nesses arquivos ou na conversa. Arquivo vazio gera perguntas, o que costuma ser a fala certa de qualquer jeito.

## Usar na call

1. Avise os participantes de que a call está sendo transcrita. Em muitos lugares isso é obrigação legal, e no Brasil a LGPD se aplica.
2. Escolha o cliente na barra e clique em **Iniciar**.
3. Leia a frase grande. A linha pequena embaixo é o que o Coach ouviu do cliente.
4. Clique em **Parar** quando a call acabar.

Prefira fone de ouvido. Em alto-falante o microfone também capta o cliente. O Coach filtra boa parte desse eco, mas o fone resolve de vez.

Se você compartilhar a tela inteira, o cliente vê a barra. Compartilhe só a janela ou a aba.

## Velocidade

O número verde na barra é o tempo entre a última palavra do cliente e a primeira palavra da sugestão. O Coach começa a escrever quando o cliente pausa por 0,35 segundo, sem esperar a frase fechar. Se o cliente continuar falando, ele descarta o rascunho e recomeça.

O modelo padrão é o `claude-haiku-5-5`, o mais rápido da Anthropic. Em **Ajustes** dá para trocar por `claude-sonnet-5-5` ou `claude-opus-5-5`, que pensam mais e demoram mais.

Também funciona com qualquer gateway compatível com a API da OpenAI: escolha essa opção em **Ajustes** e preencha URL, chave, cabeçalhos e parâmetros extras.

## O que fica guardado

O áudio e o texto da call vão para o ElevenLabs e para o provedor do modelo, e o Coach não grava nada em disco. Fechou a barra, a conversa acabou. As políticas de retenção desses dois serviços continuam valendo.

## Rodar pelo código

Precisa de Node 22 ou mais novo.

```bash
npm install
npm test
npm start
npm run dist   # gera dist/Coach-Setup.exe
```

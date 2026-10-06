class Produto {
    #preco;
    #quantidade;

    constructor(nome, preco, quantidade, id = null) {
        if (!nome || preco <= 0 || quantidade <= 0) {
            throw new Error('Dados inválidos para o produto.');
        }

        this.id = id;
        this.nome = nome;
        this.#preco = parseFloat(preco);
        this.#quantidade = parseInt(quantidade, 10);
    }

    get preco() { return this.#preco; }
    get quantidade() { return this.#quantidade; }

    valorTotal() {
        return this.#preco * this.#quantidade;
    }

    toJSON() {
        return {
            id: this.id,
            nome: this.nome,
            preco: this.#preco,
            quantidade: this.#quantidade
        };
    }
}

const API_URL = '/produtos';

function obterToken() {
    return localStorage.getItem('token');
}

function obterUsuario() {
    try {
        return JSON.parse(localStorage.getItem('usuario'));
    } catch {
        return null;
    }
}

function ehAdmin() {
    const usuario = obterUsuario();
    return usuario && usuario.acesso === true;
}

function headersAutenticados() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${obterToken()}`
    };
}

function sair() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = 'inicio.html';
}

async function fazerLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const senha = document.getElementById('loginSenha').value;

    try {
        const resposta = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.erro || 'Erro ao fazer login.');
        }

        localStorage.setItem('token', dados.token);
        localStorage.setItem('usuario', JSON.stringify(dados.usuario));
        window.location.href = 'index.html';
    } catch (erro) {
        alert(erro.message);
    }
}

async function fazerRegistro(e) {
    e.preventDefault();

    const nome = document.getElementById('registroNome').value;
    const email = document.getElementById('registroEmail').value;
    const senha = document.getElementById('registroSenha').value;
    const acesso = document.getElementById('registroAcesso').value === 'true';

    try {
        const resposta = await fetch('/auth/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email, senha, acesso })
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.erro || 'Erro ao registrar.');
        }

        alert('Conta criada com sucesso. Agora faça login.');
        window.location.href = 'login.html';
    } catch (erro) {
        alert(erro.message);
    }
}

async function renderizarTabela() {
    try {
        const resposta = await fetch(API_URL);

        if (!resposta.ok) {
            throw new Error('Erro ao buscar produtos.');
        }

        const dados = await resposta.json();
        const tabela = document.querySelector('#tabela-produtos tbody');

        if (!tabela) return;

        tabela.innerHTML = '';
        let totalAcumulado = 0;

        dados.forEach((item) => {
            const produto = new Produto(item.nome, item.preco, item.quantidade, item.id);
            totalAcumulado += produto.valorTotal();

            const row = document.createElement('tr');

            const nome = document.createElement('td');
            nome.textContent = produto.nome;

            const preco = document.createElement('td');
            preco.textContent = `R$ ${produto.preco.toFixed(2)}`;

            const quantidade = document.createElement('td');
            quantidade.textContent = produto.quantidade;

            const totalItem = document.createElement('td');
            totalItem.textContent = `R$ ${produto.valorTotal().toFixed(2)}`;

            const acoes = document.createElement('td');

            if (ehAdmin()) {
                const editar = document.createElement('button');
                editar.textContent = 'Editar';
                editar.onclick = () => editarProduto(
                    produto.id,
                    produto.nome,
                    produto.preco,
                    produto.quantidade
                );

                const remover = document.createElement('button');
                remover.textContent = 'Remover';
                remover.onclick = () => excluirProduto(produto.id);

                acoes.appendChild(editar);
                acoes.appendChild(remover);
            } else {
                acoes.textContent = 'Somente visualização';
            }

            row.appendChild(nome);
            row.appendChild(preco);
            row.appendChild(quantidade);
            row.appendChild(totalItem);
            row.appendChild(acoes);
            tabela.appendChild(row);
        });

        const total = document.getElementById('total-estoque');

        if (total) {
            total.textContent = `Total em estoque: R$ ${totalAcumulado.toFixed(2)}`;
        }
    } catch (erro) {
        console.error(erro);
        alert(erro.message);
    }
}

async function adicionarProduto(e) {
    e.preventDefault();

    if (!ehAdmin()) {
        alert('Somente administradores podem adicionar produtos.');
        return;
    }

    try {
        const produto = new Produto(
            document.getElementById('nome').value,
            document.getElementById('preco').value,
            document.getElementById('quantidade').value
        );

        const resposta = await fetch(API_URL, {
            method: 'POST',
            headers: headersAutenticados(),
            body: JSON.stringify(produto.toJSON())
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.erro || 'Erro ao salvar produto.');
        }

        e.target.reset();
        await renderizarTabela();
    } catch (erro) {
        alert(erro.message);
    }
}

async function editarProduto(id, nomeAtual, precoAtual, quantidadeAtual) {
    if (!ehAdmin()) {
        alert('Somente administradores podem editar produtos.');
        return;
    }

    const nome = prompt('Nome do produto:', nomeAtual);
    if (nome === null) return;

    const preco = prompt('Preço do produto:', precoAtual);
    if (preco === null) return;

    const quantidade = prompt('Quantidade do produto:', quantidadeAtual);
    if (quantidade === null) return;

    try {
        const produto = new Produto(nome, preco, quantidade, id);

        const resposta = await fetch(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: headersAutenticados(),
            body: JSON.stringify(produto.toJSON())
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.erro || 'Erro ao atualizar produto.');
        }

        await renderizarTabela();
    } catch (erro) {
        alert(erro.message);
    }
}

async function excluirProduto(id) {
    if (!ehAdmin()) {
        alert('Somente administradores podem remover produtos.');
        return;
    }

    if (!confirm('Deseja remover esse produto?')) return;

    try {
        const resposta = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${obterToken()}`
            }
        });

        if (!resposta.ok) {
            const dados = await resposta.json();
            throw new Error(dados.erro || 'Erro ao remover o produto.');
        }

        await renderizarTabela();
    } catch (erro) {
        alert(erro.message);
    }
}

async function limparTabela() {
    if (!ehAdmin()) {
        alert('Somente administradores podem limpar a tabela.');
        return;
    }

    if (!confirm('Deseja mesmo limpar toda a tabela?')) return;

    try {
        const resposta = await fetch(API_URL, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${obterToken()}`
            }
        });

        if (!resposta.ok) {
            const dados = await resposta.json();
            throw new Error(dados.erro || 'Erro ao limpar a tabela.');
        }

        await renderizarTabela();
    } catch (erro) {
        alert(erro.message);
    }
}

function configurarPaginaProdutos() {
    const form = document.getElementById('produto-form');
    const limpar = document.getElementById('limpar-tabela');
    const sairBotao = document.getElementById('sair');
    const areaAdmin = document.getElementById('area-admin');
    const aviso = document.getElementById('aviso-acesso');
    const usuarioLogado = document.getElementById('usuario-logado');

    const usuario = obterUsuario();

    if (usuarioLogado) {
        usuarioLogado.textContent = usuario
            ? `Usuário: ${usuario.nome} (${usuario.acesso ? 'Administrador' : 'Cliente'})`
            : 'Visitante';
    }

    if (sairBotao) {
        sairBotao.addEventListener('click', sair);
    }

    if (areaAdmin) {
        areaAdmin.style.display = ehAdmin() ? 'block' : 'none';
    }

    if (aviso && !ehAdmin()) {
        aviso.textContent =
            'Você está no modo de visualização. Somente administradores podem modificar produtos.';
    }

    if (form) {
        form.addEventListener('submit', adicionarProduto);
    }

    if (limpar) {
        limpar.addEventListener('click', limparTabela);
    }

    renderizarTabela();
}

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', fazerLogin);
}

const registroForm = document.getElementById('registro-form');
if (registroForm) {
    registroForm.addEventListener('submit', fazerRegistro);
}

if (document.getElementById('tabela-produtos')) {
    configurarPaginaProdutos();
}

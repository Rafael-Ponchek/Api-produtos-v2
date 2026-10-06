require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json());

const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;

const pool = databaseUrl
    ? new Pool({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
    })
    : null;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'inicio.html'));
});

function verificarConfiguracao(res) {
    if (!pool) {
        res.status(500).json({ erro: 'DATABASE_URL não está configurada na Vercel.' });
        return false;
    }

    if (!jwtSecret) {
        res.status(500).json({ erro: 'JWT_SECRET não está configurada na Vercel.' });
        return false;
    }

    return true;
}

app.post('/auth/registro', async (req, res) => {
    if (!verificarConfiguracao(res)) return;

    const { nome, email, senha, acesso } = req.body;

    if (!nome || !email || !senha) {
        return res.status(400).json({
            erro: 'Nome, email e senha são obrigatórios.'
        });
    }

    if (senha.length < 6) {
        return res.status(400).json({
            erro: 'A senha deve possuir pelo menos 6 caracteres.'
        });
    }

    const novoAcesso = acesso === true;

    try {
        const usuarioExistente = await pool.query(
            'SELECT id FROM usuario WHERE email = $1',
            [email]
        );

        if (usuarioExistente.rows.length > 0) {
            return res.status(409).json({
                erro: 'Este email já está cadastrado.'
            });
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        const result = await pool.query(
            'INSERT INTO usuario (nome, email, senha, acesso) VALUES ($1, $2, $3, $4) RETURNING id, nome, email, acesso',
            [nome, email, senhaHash, novoAcesso]
        );

        res.status(201).json({
            mensagem: novoAcesso
                ? 'Administrador cadastrado com sucesso.'
                : 'Usuário cadastrado com sucesso.',
            usuario: result.rows[0]
        });

    } catch (erro) {
        console.error('ERRO AO REGISTRAR:', erro);

        res.status(500).json({
            erro: 'Erro ao registrar usuário.',
            detalhe: erro.message
        });
    }
});

app.post('/auth/login', async (req, res) => {
    if (!verificarConfiguracao(res)) return;

    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });
    }

    try {
        const result = await pool.query(
            'SELECT id, nome, email, senha, acesso FROM usuario WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ erro: 'Email ou senha inválidos.' });
        }

        const usuario = result.rows[0];
        const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

        if (!senhaCorreta) {
            return res.status(401).json({ erro: 'Email ou senha inválidos.' });
        }

        const token = jwt.sign(
            {
                id: usuario.id,
                acesso: usuario.acesso
            },
            jwtSecret,
            { expiresIn: '2h' }
        );

        res.status(200).json({
            mensagem: 'Login realizado com sucesso.',
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                acesso: usuario.acesso
            }
        });
    } catch (erro) {
        console.error('ERRO AO FAZER LOGIN:', erro);
        res.status(500).json({
            erro: 'Erro ao fazer login.',
            detalhe: erro.message
        });
    }
});

function autenticar(req, res, next) {
    const cabecalho = req.headers.authorization;

    if (!cabecalho || !cabecalho.startsWith('Bearer ')) {
        return res.status(401).json({ erro: 'Token JWT não informado.' });
    }

    const token = cabecalho.split(' ')[1];

    try {
        req.usuario = jwt.verify(token, jwtSecret);
        next();
    } catch (erro) {
        return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }
}

function somenteAdmin(req, res, next) {
    if (!req.usuario || req.usuario.acesso !== true) {
        return res.status(403).json({
            erro: 'Acesso negado. Somente administradores podem modificar produtos.'
        });
    }

    next();
}

// GET é público.
app.get('/produtos', async (req, res) => {
    if (!pool) {
        return res.status(500).json({ erro: 'DATABASE_URL não está configurada na Vercel.' });
    }

    try {
        const result = await pool.query('SELECT * FROM produtos ORDER BY id ASC');
        res.status(200).json(result.rows);
    } catch (erro) {
        console.error('ERRO POSTGRES:', erro);
        res.status(500).json({
            erro: 'Erro ao buscar produtos',
            detalhe: erro.message
        });
    }
});

// Apenas administrador pode adicionar.
app.post('/produtos', autenticar, somenteAdmin, async (req, res) => {
    if (!pool) {
        return res.status(500).json({ erro: 'DATABASE_URL não está configurada na Vercel.' });
    }

    const { nome, preco, quantidade } = req.body;
    const p = Number(preco);
    const q = Number(quantidade);

    if (!nome || !Number.isFinite(p) || !Number.isInteger(q) || p <= 0 || q <= 0) {
        return res.status(400).json({ erro: 'Dados inválidos.' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO produtos(nome, preco, quantidade) VALUES($1, $2, $3) RETURNING *',
            [nome, p, q]
        );

        res.status(201).json(result.rows[0]);
    } catch (erro) {
        console.error('ERRO POSTGRES:', erro);
        res.status(500).json({
            erro: 'Erro ao inserir produto.',
            detalhe: erro.message
        });
    }
});

// Apenas administrador pode editar.
app.put('/produtos/:id', autenticar, somenteAdmin, async (req, res) => {
    if (!pool) {
        return res.status(500).json({ erro: 'DATABASE_URL não está configurada na Vercel.' });
    }

    const { nome, preco, quantidade } = req.body;
    const p = Number(preco);
    const q = Number(quantidade);

    if (!nome || !Number.isFinite(p) || !Number.isInteger(q) || p <= 0 || q <= 0) {
        return res.status(400).json({ erro: 'Dados inválidos.' });
    }

    try {
        const result = await pool.query(
            'UPDATE produtos SET nome = $1, preco = $2, quantidade = $3 WHERE id = $4 RETURNING *',
            [nome, p, q, req.params.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ erro: 'Produto não encontrado.' });
        }

        res.status(200).json(result.rows[0]);
    } catch (erro) {
        console.error('ERRO POSTGRES:', erro);
        res.status(500).json({
            erro: 'Erro ao atualizar produto.',
            detalhe: erro.message
        });
    }
});

// Apenas administrador pode remover.
app.delete('/produtos/:id', autenticar, somenteAdmin, async (req, res) => {
    if (!pool) {
        return res.status(500).json({ erro: 'DATABASE_URL não está configurada na Vercel.' });
    }

    try {
        const result = await pool.query(
            'DELETE FROM produtos WHERE id = $1',
            [req.params.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ erro: 'Produto não encontrado.' });
        }

        res.status(204).send();
    } catch (erro) {
        console.error('ERRO POSTGRES:', erro);
        res.status(500).json({
            erro: 'Erro ao deletar produto.',
            detalhe: erro.message
        });
    }
});

// Apenas administrador pode limpar.
app.delete('/produtos', autenticar, somenteAdmin, async (req, res) => {
    if (!pool) {
        return res.status(500).json({ erro: 'DATABASE_URL não está configurada na Vercel.' });
    }

    try {
        await pool.query('DELETE FROM produtos');
        res.status(204).send();
    } catch (erro) {
        console.error('ERRO POSTGRES:', erro);
        res.status(500).json({
            erro: 'Erro ao limpar produtos.',
            detalhe: erro.message
        });
    }
});

module.exports = app;

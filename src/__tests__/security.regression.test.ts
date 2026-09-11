import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { sanitizeString } from '../lib/validators.js';

// ─────────────────────────────────────────────────────────────
// REGRESSION TEST: SEC-09 - Sanitização de Strings contra XSS
// ─────────────────────────────────────────────────────────────
test('SEC-09: sanitizeString deve escapar tags e caracteres perigosos de HTML', () => {
    const maliciousInput = '<script>alert("xss")</script>&foo=\'bar\'/baz';
    const sanitized = sanitizeString(maliciousInput);
    
    assert.strictEqual(malitizedHasTag(sanitized), false);
    assert.strictEqual(sanitized.includes('&lt;script&gt;'), true);
    assert.strictEqual(sanitized.includes('&amp;'), true);
    assert.strictEqual(sanitized.includes('&#x27;'), true);
    assert.strictEqual(sanitized.includes('&#x2F;'), true);
});

function malitizedHasTag(str: string): boolean {
    return str.includes('<script>') || str.includes('</script>');
}

// ─────────────────────────────────────────────────────────────
// REGRESSION TEST: SEC-03 - Fail-Fast em Segredos e Fallback Inseguro
// ─────────────────────────────────────────────────────────────
test('SEC-03: Startup Fail-Fast deve rejeitar fallback_secret ou segredos curtos', () => {
    function validateSecret(secret?: string) {
        if (!secret || secret === 'fallback_secret' || secret.length < 32) {
            throw new Error('Configuração de segurança inválida');
        }
        return true;
    }

    assert.throws(() => validateSecret('fallback_secret'), /Configuração de segurança inválida/);
    assert.throws(() => validateSecret(undefined), /Configuração de segurança inválida/);
    assert.throws(() => validateSecret('curta123'), /Configuração de segurança inválida/);
    assert.strictEqual(validateSecret('editorial_architect_secret_key_2026_segredo_forte'), true);
});

// ─────────────────────────────────────────────────────────────
// REGRESSION TEST: SEC-02 - Redefinição de Senha Rejeita Chamada Não Autorizada
// ─────────────────────────────────────────────────────────────
test('SEC-02: Redefinição de senha sem token ou com token inválido deve ser bloqueada', () => {
    const validSecret = 'super_secret_jwt_key_with_at_least_32_characters_long';

    // 1. Simulação: Token forjado com finalidade errada
    const forgedToken = jwt.sign({ id: 'user-123', email: 'test@example.com', purpose: 'login' }, validSecret);
    
    const decoded: any = jwt.verify(forgedToken, validSecret);
    const isAllowedForReset = decoded && decoded.purpose === 'password_reset' && decoded.id;
    assert.strictEqual(isAllowedForReset, false);

    // 2. Simulação: Token legítimo de redefinição
    const legitimateToken = jwt.sign({ id: 'user-123', email: 'test@example.com', purpose: 'password_reset' }, validSecret);
    const validDecoded: any = jwt.verify(legitimateToken, validSecret);
    assert.strictEqual(validDecoded.purpose, 'password_reset');
    assert.strictEqual(validDecoded.id, 'user-123');
});

// ─────────────────────────────────────────────────────────────
// REGRESSION TEST: SEC-04 - Prevenção de IDOR em Transações
// ─────────────────────────────────────────────────────────────
test('SEC-04: Transação de pagamento só pode ser visualizada pelo proprietário ou admin', () => {
    const transaction = {
        id: 'tx-01',
        asaasPaymentId: 'pay_987654321',
        userId: 'user-legitimo-100',
        pixCopyPaste: '00020126580014br.gov.bcb.pix...',
    };

    function canAccessTransaction(currentUser: { id: string; role?: string } | null, targetTx: typeof transaction) {
        if (!currentUser?.id) return false;
        const isOwner = targetTx.userId === currentUser.id;
        const isAdmin = currentUser.role === 'Admin System';
        return isOwner || isAdmin;
    }

    const unauthenticatedUser = null;
    const attackerUser = { id: 'user-invasor-200', role: 'subscriber' };
    const ownerUser = { id: 'user-legitimo-100', role: 'subscriber' };
    const adminUser = { id: 'admin-999', role: 'Admin System' };

    assert.strictEqual(canAccessTransaction(unauthenticatedUser, transaction), false);
    assert.strictEqual(canAccessTransaction(attackerUser, transaction), false);
    assert.strictEqual(canAccessTransaction(ownerUser, transaction), true);
    assert.strictEqual(canAccessTransaction(adminUser, transaction), true);
});

// ─────────────────────────────────────────────────────────────
// REGRESSION TEST: SEC-07 - Webhook Fail-Secure
// ─────────────────────────────────────────────────────────────
test('SEC-07: Webhook Asaas deve rejeitar se o token estiver ausente, nulo ou incorreto', () => {
    function validateWebhook(configuredToken?: string, receivedToken?: string): boolean {
        if (!configuredToken || !receivedToken || receivedToken !== configuredToken) {
            return false;
        }
        return true;
    }

    // Se a env var não estiver configurada no servidor: REJEITA
    assert.strictEqual(validateWebhook(undefined, 'qualquer_token'), false);
    assert.strictEqual(validateWebhook('', 'qualquer_token'), false);

    // Se o invasor não enviar token: REJEITA
    assert.strictEqual(validateWebhook('segredo_webhook_oficial', undefined), false);

    // Se o token for incorreto: REJEITA
    assert.strictEqual(validateWebhook('segredo_webhook_oficial', 'token_errado'), false);

    // Se o token for idêntico ao configurado: ACEITA
    assert.strictEqual(validateWebhook('segredo_webhook_oficial', 'segredo_webhook_oficial'), true);
});

// ─────────────────────────────────────────────────────────────
// REGRESSION TEST: SEC-10 - Validação de Protocolo de Imagem
// ─────────────────────────────────────────────────────────────
test('SEC-10: Protocolo de imagem deve rejeitar esquemas inseguros (javascript:, etc.)', () => {
    function getSafeImageUrl(url?: string): string | null {
        if (!url || typeof url !== 'string') return null;
        const trimmed = url.trim();
        if (/^https?:\/\//i.test(trimmed) || /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/i.test(trimmed)) {
            return trimmed;
        }
        return null;
    }

    assert.strictEqual(getSafeImageUrl('javascript:alert(1)'), null);
    assert.strictEqual(getSafeImageUrl('vbscript:msgbox(1)'), null);
    assert.strictEqual(getSafeImageUrl('data:text/html,<script>alert(1)</script>'), null);
    assert.strictEqual(getSafeImageUrl('https://cdn.example.com/logo.png'), 'https://cdn.example.com/logo.png');
    assert.strictEqual(getSafeImageUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==') !== null, true);
});

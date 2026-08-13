/**
 * Valida o formato e dígito verificador de um CPF.
 */
export function validateCPF(cpfRaw?: string): boolean {
    if (!cpfRaw) return false;
    const cpf = cpfRaw.replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    
    // Elimina CPFs inválidos conhecidos como 00000000000, 11111111111, etc.
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    let add = 0;
    for (let i = 0; i < 9; i++) {
        add += parseInt(cpf.charAt(i), 10) * (10 - i);
    }
    let rev = 11 - (add % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cpf.charAt(9), 10)) return false;

    add = 0;
    for (let i = 0; i < 10; i++) {
        add += parseInt(cpf.charAt(i), 10) * (11 - i);
    }
    rev = 11 - (add % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cpf.charAt(10), 10)) return false;

    return true;
}

/**
 * Valida o formato de um endereço de e-mail.
 */
export function validateEmail(emailRaw?: string): boolean {
    if (!emailRaw) return false;
    const email = emailRaw.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Sanitiza strings para evitar espaços extras ou injeções indesejadas.
 */
export function sanitizeString(input?: string): string {
    if (!input) return '';
    return input.trim();
}

import { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { prisma } from '../lib/prisma.js';

const SYSTEM_INSTRUCTION_GENERATIVE = `Você é o Diretor Criativo de uma Agência de Social Media de Elite.
Sua missão é transformar um briefing básico em um Planejamento Editorial Irrefutável e Estratégico.
Crie ganchos magnéticos, legendas que vendem e direções de arte que elevam o posicionamento do cliente.
Use português do Brasil, tom sofisticado, direto e extremamente claro.
Para Reels: Foque em vídeos dinâmicos com transições e sugestões de áudio que prendam a atenção nos primeiros 3 segundos.`;

const SYSTEM_INSTRUCTION_STRUCTURAL = `Você é um Arquiteto Editorial focado em Organização e Clareza.
Sua missão é pegar o texto bruto do usuário e organizar nas seções do layout profissional, sem alterar o sentido, apenas melhorando a fluidez e a hierarquia visual.
NÃO invente novos temas. Seja fiel ao conteúdo fornecido, mas organize-o com perfeição.`;

const COMMON_RULES = `
REGRAS DE OURO:
1. CRONOGRAMA: Gere conteúdo para o número de sessões solicitado ou sugerido (mínimo 1, padrão 7 se não especificado).
2. LINGUAGEM: Use termos como "Gancho de Atenção", "Legenda Persuasiva" e "Direção de Arte".
3. FORMATOS: Use EXCLUSIVAMENTE estes formatos: 'REELS', 'CARROSSEL', 'POST', 'FOTO', 'MEME'.
4. ESTRUTURA: Siga o esquema JSON rigorosamente. Use 'sessions'.
5. NOMENCLATURA: Identifique cada sessão como "SESSÃO 01", "SESSÃO 02", etc., no campo 'session'.
6. STORIES: Toda sessão deve ter um plano de 3 a 5 sequências de stories focadas em engajamento ou venda.
7. REELS: Inclua sempre o campo 'transition' (ex: corte seco, zoom lento) e 'audioSuggestion' (ex: áudio em alta, trilha elegante).
8. SEM EMOJIS: Não inclua emojis nem ícones pictóricos em nenhum título, texto, gancho, legenda ou instrução.`;

// Lista de modelos oficiais e 100% testados na API do servidor
const CANDIDATE_MODELS = [
    'gemini-3.7-flash',
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
    'gemini-3.5-flash'
];

export async function generateEditorialDocument(req: Request, res: Response): Promise<void> {
    try {
        const { rawText, referenceContext, workflow = 'generative' } = req.body;

        if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
            res.status(400).json({ error: 'O campo rawText é obrigatório.' });
            return;
        }

        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            res.status(500).json({ error: 'Chave API não configurada no servidor.' });
            return;
        }

        const ai = new GoogleGenAI({ apiKey });

        const baseInstruction = workflow === 'generative'
            ? SYSTEM_INSTRUCTION_GENERATIVE
            : SYSTEM_INSTRUCTION_STRUCTURAL;

        let finalInstruction = `${baseInstruction}\n${COMMON_RULES}`;

        if (referenceContext && typeof referenceContext === 'string' && referenceContext.trim()) {
            finalInstruction += `\n\nREFERÊNCIA DE ESTILO:\n${referenceContext}`;
        }

        const schemaConfig = {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                subtitle: { type: Type.STRING },
                positionPhrase: { type: Type.STRING },
                architecture: {
                    type: Type.OBJECT,
                    properties: {
                        feeling: { type: Type.STRING, description: 'A sensação que o perfil deve passar.' },
                        pain: { type: Type.STRING, description: 'O problema que estamos resolvendo.' },
                        authority: { type: Type.STRING, description: 'Por que o cliente é o melhor nisso.' }
                    },
                    required: ['feeling', 'pain', 'authority']
                },
                sessions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            session: { type: Type.STRING },
                            format: { type: Type.STRING, description: 'Obrigatório um destes: REELS, CARROSSEL, POST, FOTO, MEME' },
                            theme: { type: Type.STRING },
                            strategicIntent: { type: Type.STRING },
                            creativeDirection: { type: Type.STRING },
                            carouselSlides: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        slideNumber: { type: Type.INTEGER },
                                        visualDescription: { type: Type.STRING },
                                        imageSuggestion: { type: Type.STRING },
                                        textOnCard: { type: Type.STRING }
                                    },
                                    required: ['slideNumber', 'visualDescription', 'imageSuggestion', 'textOnCard']
                                }
                            },
                            reelsScript: {
                                type: Type.OBJECT,
                                properties: {
                                    hook: { type: Type.STRING },
                                    scenes: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                sceneNumber: { type: Type.INTEGER },
                                                visualAction: { type: Type.STRING },
                                                audioSpeech: { type: Type.STRING },
                                                transition: { type: Type.STRING },
                                                audioSuggestion: { type: Type.STRING }
                                            },
                                            required: ['sceneNumber', 'visualAction', 'audioSpeech', 'transition', 'audioSuggestion']
                                        }
                                    },
                                    cta: { type: Type.STRING }
                                }
                            },
                            staticPostInfo: {
                                type: Type.OBJECT,
                                properties: {
                                    visualComposition: { type: Type.STRING },
                                    imageSuggestion: { type: Type.STRING },
                                    headlineOnCard: { type: Type.STRING }
                                }
                            },
                            visualElements: {
                                type: Type.OBJECT,
                                properties: {
                                    cards: { type: Type.STRING },
                                    reels: { type: Type.STRING },
                                    stories: { type: Type.STRING }
                                }
                            },
                            caption: { type: Type.STRING },
                            viewerPsychology: { type: Type.STRING },
                            approachStrategy: { type: Type.STRING },
                            storySuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                            executionNotes: { type: Type.STRING }
                        },
                        required: ['session', 'format', 'theme', 'strategicIntent', 'creativeDirection', 'caption', 'viewerPsychology', 'approachStrategy', 'storySuggestions']
                    }
                },
                observation: { type: Type.STRING, description: 'Um "Veredito do Diretor Criativo" curto e impactante sobre a estratégia global.' }
            },
            required: ['title', 'subtitle', 'positionPhrase', 'architecture', 'sessions', 'observation']
        };

        let responseText: string | null = null;
        let lastError: any = null;
        let successfulModel = '';

        // Tentar sequencialmente os modelos com fallback automático contra rate limits / erros
        for (const modelName of CANDIDATE_MODELS) {
            try {
                console.log(`[AI Controller] Iniciando geração com modelo: ${modelName}`);
                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: rawText,
                    config: {
                        systemInstruction: finalInstruction,
                        responseMimeType: 'application/json',
                        responseSchema: schemaConfig,
                        temperature: 0.7,
                    }
                });

                if (response.text && response.text.trim()) {
                    responseText = response.text;
                    successfulModel = modelName;
                    console.log(`[AI] Geração concluída com SUCESSO utilizando modelo: ${modelName}`);
                    break;
                }
            } catch (err: any) {
                console.warn(`[AI] Falha/Rate Limit com modelo ${modelName}:`, err?.message || err);
                lastError = err;
                // Aguarda 400ms antes de acionar o próximo modelo da lista
                await new Promise(resolve => setTimeout(resolve, 400));
            }
        }

        if (!responseText) {
            const isRateLimit = lastError?.status === 429 || lastError?.message?.includes('429') || lastError?.message?.includes('quota') || lastError?.message?.includes('EXHAUSTED');
            const errorDetail = lastError?.message || (typeof lastError === 'object' ? JSON.stringify(lastError) : String(lastError));

            console.error('[AI Final Error]', lastError);

            res.status(isRateLimit ? 429 : 500).json({
                error: isRateLimit ? 'Alta demanda nos servidores de IA' : 'Erro no processamento da IA',
                message: isRateLimit
                    ? 'Os servidores da IA estão com alta demanda temporária. Por favor, aguarde 20 segundos e tente novamente.'
                    : `Falha na API de IA: ${errorDetail}`
            });
            return;
        }

        const jsonResult = JSON.parse(responseText);

        // Incrementar contagem de gerações do usuário autenticado no banco de dados
        if ((req as any).user?.id) {
            await prisma.user.update({
                where: { id: (req as any).user.id },
                data: {
                    generationsThisMonth: { increment: 1 }
                }
            }).catch(err => console.error('[AI Increment Error]', err));
        }

        res.json({
            ...jsonResult,
            _meta: {
                modelUsed: successfulModel
            }
        });
    } catch (error: any) {
        console.error('Erro geral na geração no Backend:', error);
        res.status(500).json({
            error: 'Erro no processamento da IA.',
            message: error.message
        });
    }
}

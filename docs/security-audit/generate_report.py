import os
import sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether, PageBreak, HRFlowable
)
from reportlab.pdfgen import canvas

# Paleta de Cores Oficial Requisitada
COLOR_CRITICA = colors.HexColor('#B91C1C')
COLOR_ALTA = colors.HexColor('#EA580C')
COLOR_MEDIA = colors.HexColor('#D97706')
COLOR_BAIXA = colors.HexColor('#2563EB')
COLOR_FORTE = colors.HexColor('#059669')

COLOR_DARK = colors.HexColor('#0F172A')
COLOR_NAVY = colors.HexColor('#1E293B')
COLOR_TEXT = colors.HexColor('#334155')
COLOR_MUTED = colors.HexColor('#64748B')
COLOR_LIGHT_BG = colors.HexColor('#F8FAFC')
COLOR_BORDER = colors.HexColor('#E2E8F0')
COLOR_CARD_BG = colors.HexColor('#FFFFFF')
COLOR_CODE_BG = colors.HexColor('#F1F5F9')

# Canvas customizado para cabeçalho, rodapé e numeração "Página X de Y"
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_decorations(self, page_count):
        self.saveState()
        page_w, page_h = A4
        margin_x = 2 * cm

        # Não exibe cabeçalho nem rodapé na capa (Página 1)
        if self._pageNumber > 1:
            # Cabeçalho
            self.setFont('Helvetica-Bold', 7)
            self.setFillColor(COLOR_NAVY)
            self.drawString(margin_x, page_h - 1.2 * cm, "RELATÓRIO DE AUDITORIA DE SEGURANÇA")
            
            self.setFont('Helvetica', 7)
            self.setFillColor(COLOR_MUTED)
            header_right = "EDITORIAL ARCHITECT — BACKEND & FRONTEND"
            self.drawRightString(page_w - margin_x, page_h - 1.2 * cm, header_right)
            
            self.setStrokeColor(COLOR_BORDER)
            self.setLineWidth(0.75)
            self.line(margin_x, page_h - 1.35 * cm, page_w - margin_x, page_h - 1.35 * cm)

            # Rodapé
            self.setStrokeColor(COLOR_BORDER)
            self.setLineWidth(0.75)
            self.line(margin_x, 1.4 * cm, page_w - margin_x, 1.4 * cm)

            self.setFont('Helvetica', 7)
            self.setFillColor(COLOR_MUTED)
            self.drawString(margin_x, 1.0 * cm, "CONFIDENCIAL — DOCUMENTO DE AUDITORIA DE CÓDIGO E GOVERNANÇA")

            page_str = f"Página {self._pageNumber} de {page_count}"
            self.setFont('Helvetica-Bold', 7)
            self.setFillColor(COLOR_NAVY)
            self.drawRightString(page_w - margin_x, 1.0 * cm, page_str)

        self.restoreState()


def generate_charts(output_dir):
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. Gráfico de Rosca (Donut Chart) por Severidade
    fig, ax = plt.subplots(figsize=(4.2, 3.2), subplot_kw=dict(aspect="equal"), dpi=300)
    
    labels = ['Crítica (3)', 'Alta (4)', 'Média (1)', 'Baixa (2)']
    sizes = [3, 4, 1, 2]
    colors_list = ['#B91C1C', '#EA580C', '#D97706', '#2563EB']
    
    wedges, texts, autotexts = ax.pie(
        sizes, 
        autopct='%1.0f%%',
        startangle=140,
        colors=colors_list,
        pctdistance=0.75,
        textprops=dict(color="w", weight="bold", fontsize=9),
        wedgeprops=dict(width=0.45, edgecolor='white', linewidth=2)
    )
    
    ax.text(0, 0, "10\nAchados", ha='center', va='center', fontsize=11, fontweight='bold', color='#0F172A')
    ax.legend(wedges, labels, title="Severidades", loc="center left", bbox_to_anchor=(1, 0, 0.5, 1), fontsize=8, title_fontsize=8, frameon=False)
    
    donut_path = os.path.join(output_dir, "chart_severidade.png")
    plt.tight_layout()
    plt.savefig(donut_path, transparent=True, bbox_inches='tight', dpi=300)
    plt.close()

    # 2. Gráfico de Barras por Categoria
    fig, ax = plt.subplots(figsize=(6.5, 3.2), dpi=300)
    
    categories = [
        '1. Banco sem\nTranca', 
        '2. Permissão\nNavegador', 
        '3. IDOR /\nBOLA', 
        '4. Chaves &\nHardcode', 
        '5. Inputs /\nXSS', 
        'Pontos Fortes\nVerificados'
    ]
    counts = [2, 2, 3, 5, 2, 5]
    bar_colors = ['#EA580C', '#B91C1C', '#B91C1C', '#B91C1C', '#2563EB', '#059669']
    
    bars = ax.bar(categories, counts, color=bar_colors, width=0.55, edgecolor='none', zorder=3)
    
    ax.set_ylabel('Quantidade de Itens', fontsize=8, fontweight='bold', color='#1E293B')
    ax.set_ylim(0, 6)
    ax.grid(axis='y', linestyle='--', alpha=0.3, zorder=0)
    ax.tick_params(axis='both', which='major', labelsize=7.5, colors='#334155')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#CBD5E1')
    ax.spines['bottom'].set_color('#CBD5E1')
    
    for bar in bars:
        height = bar.get_height()
        ax.annotate(f'{height}',
                    xy=(bar.get_x() + bar.get_width() / 2, height),
                    xytext=(0, 3),
                    textcoords="offset points",
                    ha='center', va='bottom', fontsize=8, fontweight='bold', color='#0F172A')

    bars_path = os.path.join(output_dir, "chart_categorias.png")
    plt.tight_layout()
    plt.savefig(bars_path, transparent=True, bbox_inches='tight', dpi=300)
    plt.close()

    return donut_path, bars_path


def build_pdf(filename="relatorio-auditoria-seguranca.pdf"):
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    output_pdf = os.path.join(curr_dir, filename)
    donut_img, bars_img = generate_charts(curr_dir)

    margin = 2 * cm
    doc = SimpleDocTemplate(
        output_pdf,
        pagesize=A4,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=margin,
        bottomMargin=margin
    )

    usable_width = A4[0] - 2 * margin

    styles = getSampleStyleSheet()

    # Custom Typography Styles
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=COLOR_DARK,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=COLOR_MUTED,
        spaceAfter=14
    )

    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13.5,
        leading=17.5,
        textColor=COLOR_NAVY,
        spaceBefore=12,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=COLOR_NAVY,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11.5,
        textColor=COLOR_TEXT,
        spaceAfter=5
    )

    body_bold = ParagraphStyle(
        'BodyBold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    badge_style = ParagraphStyle(
        'BadgeStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7,
        leading=9,
        alignment=1,
        textColor=colors.white
    )

    code_style = ParagraphStyle(
        'CodeSnippet',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=6.5,
        leading=8.5,
        textColor=colors.HexColor('#0F172A'),
        backColor=COLOR_CODE_BG,
        borderColor=COLOR_BORDER,
        borderWidth=0.5,
        borderPadding=3,
        spaceAfter=3
    )

    issue_block_style = ParagraphStyle(
        'IssueBlock',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=6,
        leading=8,
        textColor=colors.HexColor('#1E293B'),
        backColor=colors.HexColor('#F8FAFC'),
        borderColor=colors.HexColor('#CBD5E1'),
        borderWidth=0.5,
        borderPadding=5,
        spaceAfter=6
    )

    story = []

    # ════════════════════════════════════════════════════════════════
    # PÁGINA 1: CAPA E NOTA METODOLÓGICA
    # ════════════════════════════════════════════════════════════════
    story.append(Paragraph("<font color='#B91C1C'><b>● RELATÓRIO TÉCNICO DE AUDITORIA DE SEGURANÇA</b></font>", body_bold))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph("Relatório de Auditoria de Segurança — Editorial Architect", title_style))
    story.append(Paragraph("Avaliação Estática e Dinâmica de Vulnerabilidades em Código-Fonte, Controle de Acesso e Gestão de Segredos", subtitle_style))
    
    story.append(HRFlowable(width="100%", thickness=2, color=COLOR_DARK, spaceBefore=2, spaceAfter=10))

    meta_data = [
        [
            Paragraph("<b>Projeto Auditado:</b>", body_style),
            Paragraph("Editorial Architect (Fullstack Platform)", body_bold),
            Paragraph("<b>Data da Auditoria:</b>", body_style),
            Paragraph("30 de Agosto de 2026", body_bold)
        ],
        [
            Paragraph("<b>Escopo Repositórios:</b>", body_style),
            Paragraph("<code>editorial-backend</code> + <code>editorial-frontend</code>", body_style),
            Paragraph("<b>Classificação:</b>", body_style),
            Paragraph("<font color='#B91C1C'><b>RESTRITO / CONFIDENCIAL</b></font>", body_style)
        ],
        [
            Paragraph("<b>Stack Backend:</b>", body_style),
            Paragraph("Node.js 18+, Express 4.18, Prisma ORM 6.19 (MySQL)", body_style),
            Paragraph("<b>Stack Frontend:</b>", body_style),
            Paragraph("React 19, Vite 6, Tailwind CSS, CASL Ability", body_style)
        ],
        [
            Paragraph("<b>Auth & Gateway:</b>", body_style),
            Paragraph("JWT + Bcrypt (Backend), Asaas API v3, Gemini AI", body_style),
            Paragraph("<b>Deploy & Infra:</b>", body_style),
            Paragraph("Railway Cloud (railway.toml / railway.json)", body_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[usable_width*0.22, usable_width*0.32, usable_width*0.20, usable_width*0.26])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLOR_LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 5*mm))

    story.append(Paragraph("1. NOTA METODOLÓGICA & DETECÇÃO DE STACK", h1_style))
    story.append(Paragraph(
        "A presente auditoria adotou o modelo de análise <i>White-Box</i> sobre 100% da base de código dos repositórios "
        "<code>editorial-backend</code> e <code>editorial-frontend</code>. "
        "Antes do início dos testes, a arquitetura e a cadeia de suprimentos de software foram mapeadas para calibrar "
        "com precisão os vetores de ataque equivalentes na stack real:",
        body_style
    ))

    method_rows = [
        [
            Paragraph("<b>Categoria Auditada</b>", body_bold),
            Paragraph("<b>Mapeamento Técnico na Stack do Projeto</b>", body_bold),
            Paragraph("<b>Mecanismo do Projeto & Cobertura</b>", body_bold)
        ],
        [
            Paragraph("<b>1. Banco sem Tranca</b><br/>(Isolamento Tenancy)", body_style),
            Paragraph("Stack utiliza MySQL via Prisma ORM sem Row-Level Security (RLS) nativo. A tranca depende de queries com <code>where: { userId }</code> em cada handler.", body_style),
            Paragraph("Auditado handler por handler em busca de queries com <code>findMany</code>, <code>findFirst</code> e agregações sem filtro do usuário da sessão.", body_style)
        ],
        [
            Paragraph("<b>2. Permissão no Navegador</b><br/>(Bypass de RBAC)", body_style),
            Paragraph("Frontend implementa controle visual com <code>@casl/ability</code> e rotas com <code>ProtectedRoute requireAdmin</code>. Backend usa <code>checkPermission</code>.", body_style),
            Paragraph("Cruzamento exato entre os gates de UI (menus, botões de admin, páginas restritas) e os endpoints correspondentes no Express.", body_style)
        ],
        [
            Paragraph("<b>3. IDOR / BOLA</b><br/>(Broken Object Level)", body_style),
            Paragraph("Operações CRUD que recebem IDs (ULID ou Asaas ID) via <code>req.params</code> ou <code>req.body</code>.", body_style),
            Paragraph("Inspeção exaustiva em todos os endpoints que aceitam identificadores para confirmar validação de propriedade.", body_style)
        ],
        [
            Paragraph("<b>4. Chaves Expostas</b><br/>(Hardcode & Defaults)", body_style),
            Paragraph("Tokens JWT, chaves de API (Gemini, Asaas), webhooks e credenciais de banco em código, <code>.env</code>, <code>seed.ts</code> e histórico git.", body_style),
            Paragraph("Varredura do histórico git completo (commits anteriores), inspeção do bundler Vite e análise de fallbacks inseguros.", body_style)
        ],
        [
            Paragraph("<b>5. Inputs / XSS</b><br/>(Sanitização e Injeção)", body_style),
            Paragraph("Frontend React 19 + Tailwind; Backend Express com <code>res.json()</code>. Busca por <code>dangerouslySetInnerHTML</code>, <code>innerHTML</code>, <code>eval()</code>.", body_style),
            Paragraph("Varredura em todos os 26 componentes e análise das funções de sanitização de strings no backend.", body_style)
        ]
    ]
    method_table = Table(method_rows, colWidths=[usable_width*0.24, usable_width*0.40, usable_width*0.36])
    method_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BOX', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [COLOR_CARD_BG, COLOR_LIGHT_BG])
    ]))
    story.append(method_table)
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════════
    # PÁGINA 2: RESUMO EXECUTIVO & GRÁFICOS
    # ════════════════════════════════════════════════════════════════
    story.append(Paragraph("2. RESUMO EXECUTIVO & PANORAMA DE RISCO", h1_style))
    story.append(Paragraph(
        "A auditoria de segurança identificou um total de <b>10 achados de segurança</b> e <b>5 pontos fortes arquiteturais verificados</b>. "
        "Entre os achados, destacam-se <b>3 vulnerabilidades de severidade CRÍTICA</b> que permitem tomada completa de contas (Account Takeover), "
        "forja de sessões administrativas e redefinição não autorizada de senhas de qualquer usuário cadastrado no sistema.",
        body_style
    ))
    story.append(Spacer(1, 2*mm))

    sev_summary_data = [
        [
            Paragraph("<b>Severidade</b>", body_bold),
            Paragraph("<b>Total</b>", body_bold),
            Paragraph("<b>Impacto Sistêmico</b>", body_bold),
            Paragraph("<b>SLA de Resolução Recomendado</b>", body_bold)
        ],
        [
            Paragraph("<font color='#B91C1C'><b>CRÍTICA</b></font>", body_bold),
            Paragraph("<b>3</b>", body_bold),
            Paragraph("Comprometimento total da base de usuários, tomada de contas mestre e bypass global de autenticação.", body_style),
            Paragraph("<b>Imediato (24 horas)</b>", body_style)
        ],
        [
            Paragraph("<font color='#EA580C'><b>ALTA</b></font>", body_bold),
            Paragraph("<b>4</b>", body_bold),
            Paragraph("Vazamento de chaves no bundle público, IDOR em transações financeiras e credenciais padrão em seed.", body_style),
            Paragraph("<b>Até 3 dias úteis</b>", body_style)
        ],
        [
            Paragraph("<font color='#D97706'><b>MÉDIA</b></font>", body_bold),
            Paragraph("<b>1</b>", body_bold),
            Paragraph("Bypass de regras comerciais e limites de plano no backend (white-label desprotegido).", body_style),
            Paragraph("<b>Até 10 dias úteis</b>", body_style)
        ],
        [
            Paragraph("<font color='#2563EB'><b>BAIXA / INFO</b></font>", body_bold),
            Paragraph("<b>2</b>", body_bold),
            Paragraph("Sanitização incompleta de strings e ausência de validação rígida de protocolo em URLs.", body_style),
            Paragraph("<b>Próximo ciclo de release</b>", body_style)
        ],
        [
            Paragraph("<font color='#059669'><b>PONTOS FORTES</b></font>", body_bold),
            Paragraph("<b>5</b>", body_bold),
            Paragraph("Isolamento estrito no módulo de Projetos, RBAC no Express para rotas admin e ausência total de XSS.", body_style),
            Paragraph("<b>Manter padrão e monitorar</b>", body_style)
        ]
    ]
    sev_table = Table(sev_summary_data, colWidths=[usable_width*0.20, usable_width*0.10, usable_width*0.48, usable_width*0.22])
    sev_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BOX', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [COLOR_CARD_BG, COLOR_LIGHT_BG])
    ]))
    story.append(sev_table)
    story.append(Spacer(1, 3*mm))

    story.append(Paragraph("<b>Distribuição de Severidades e Cobertura por Categoria</b>", h2_style))
    
    chart_table_data = [
        [
            Image(donut_img, width=usable_width*0.42, height=usable_width*0.30),
            Image(bars_img, width=usable_width*0.56, height=usable_width*0.30)
        ]
    ]
    chart_table = Table(chart_table_data, colWidths=[usable_width*0.43, usable_width*0.57])
    chart_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(chart_table)
    story.append(Spacer(1, 3*mm))

    story.append(Paragraph("<b>Diagnóstico de Risco Central da Plataforma:</b>", body_bold))
    story.append(Paragraph(
        "Embora o módulo nuclear de manipulação de projetos (<code>project.controller.ts</code>) tenha sido implementado "
        "com alta maturidade e isolamento estrito de inquilinos (verificando <code>where: { userId: req.user.id }</code> em todos os pontos), "
        "as adições recentes nos fluxos de pagamento (<code>payment.controller.ts</code>) e autenticação simplificada (<code>auth.controller.ts</code>) "
        "introduziram atalhos de desenvolvimento severos. A funcionalidade de <i>auto-login</i> no checkout e o reset de senha unificado "
        "não exigem credenciais anteriores nem tokens criptográficos temporários, permitindo a apropriação arbitrária de contas e dados cadastrais.",
        body_style
    ))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════════
    # PÁGINA 3: PONTOS FORTES E PONTOS FRACOS SISTÊMICOS
    # ════════════════════════════════════════════════════════════════
    story.append(Paragraph("3. PONTOS FORTES & PONTOS FRACOS SISTÊMICOS", h1_style))
    story.append(Paragraph(
        "A segurança da plataforma apresenta um forte contraste entre áreas com blindagem exemplar e fluxos periféricos vulneráveis. "
        "Abaixo estão documentadas as defesas efetivas comprovadas em código e os pontos cegos estruturais:",
        body_style
    ))
    story.append(Spacer(1, 2*mm))

    story.append(Paragraph("<font color='#059669'><b>✔ PONTOS FORTES AUDITADOS (EVIDÊNCIAS DE CÓDIGO CORRETO)</b></font>", h2_style))
    
    strong_points_data = [
        [
            Paragraph("<b>Componente / Recurso</b>", body_bold),
            Paragraph("<b>Evidência Verificada no Código Real</b>", body_bold),
            Paragraph("<b>Garantia de Segurança Obtida</b>", body_bold)
        ],
        [
            Paragraph("<b>Isolamento Estrito em Projetos</b><br/><code>project.controller.ts</code>", body_style),
            Paragraph("Linhas 48, 69, 98, 135 e 165: Todos os métodos (<code>getProjects</code>, <code>getProjectById</code>, <code>updateProject</code>, <code>deleteProject</code> e <code>getDashboardStats</code>) aplicam <code>where: { userId: req.user.id }</code>.", body_style),
            Paragraph("Impossibilita IDOR ou vazamento horizontal de projetos entre usuários.", body_style)
        ],
        [
            Paragraph("<b>Validação de RBAC no Servidor</b><br/><code>server.ts:100-115</code>", body_style),
            Paragraph("Todas as rotas sob <code>/api/admin/*</code> (roles, permissions, users, analytics) aplicam <code>checkPermission(action, subject)</code> antes dos controladores.", body_style),
            Paragraph("Usuários comuns com token JWT válido recebem HTTP 403 caso tentem acessar rotas de administração.", body_style)
        ],
        [
            Paragraph("<b>Imunidade a XSS na UI</b><br/><code>26 componentes React</code>", body_style),
            Paragraph("Zero instâncias de <code>dangerouslySetInnerHTML</code>, <code>innerHTML</code> ou <code>v-html</code>. Textos gerados por IA são interpolados via nós de texto React padrão.", body_style),
            Paragraph("Defesa nativa contra Stored e Reflected XSS em toda a interface do usuário.", body_style)
        ],
        [
            Paragraph("<b>Validação de Posse no Perfil</b><br/><code>auth.controller.ts:213</code>", body_style),
            Paragraph("Em <code>updateProfile</code> e <code>getUserAnalytics</code>, o ID alvo é extraído exclusivamente de <code>req.user.id</code>, sem aceitar IDs no body.", body_style),
            Paragraph("Garante que nenhum usuário consiga editar o perfil de terceiros via rota regular.", body_style)
        ],
        [
            Paragraph("<b>Proteção contra Exclusão de Roles de Sistema</b><br/><code>admin.controller.ts:143</code>", body_style),
            Paragraph("Validação explícita <code>if (role.isSystem) return res.status(400)</code> bloqueia deleção de perfis essenciais como 'Admin System'.", body_style),
            Paragraph("Evita negação de serviço e bloqueio permanente do console administrativo.", body_style)
        ]
    ]
    strong_table = Table(strong_points_data, colWidths=[usable_width*0.28, usable_width*0.44, usable_width*0.28])
    strong_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#064E3B')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BOX', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [COLOR_CARD_BG, COLOR_LIGHT_BG])
    ]))
    story.append(strong_table)
    story.append(Spacer(1, 3*mm))

    story.append(Paragraph("<font color='#B91C1C'><b>✖ PONTOS FRACOS CENTRAIS (VULNERABILIDADES SISTÊMICAS)</b></font>", h2_style))
    
    weak_points_data = [
        [
            Paragraph("<b>Ponto Cego Arquitetural</b>", body_bold),
            Paragraph("<b>Mecanismo da Falha</b>", body_bold),
            Paragraph("<b>Consequência Crítica</b>", body_bold)
        ],
        [
            Paragraph("<b>Account Takeover no Checkout</b><br/><code>subscribePlan</code>", body_style),
            Paragraph("Endpoint busca usuário existente apenas por e-mail fornecido no body sem exigir senha nem token de sessão, emitindo novo JWT.", body_style),
            Paragraph("Qualquer pessoa assume controle de contas existentes informando o e-mail no checkout.", body_style)
        ],
        [
            Paragraph("<b>Redefinição Arbitrária de Senha</b><br/><code>resetPassword</code>", body_style),
            Paragraph("Rota pública altera hash da senha diretamente por e-mail sem envio de token OTP/link por e-mail e devolve JWT autenticado.", body_style),
            Paragraph("Sequestro instantâneo da conta <code>editor@elite.com</code> (Admin) ou de clientes.", body_style)
        ],
        [
            Paragraph("<b>Segredo JWT Público por Fallback</b><br/><code>auth.middleware.ts:7</code>", body_style),
            Paragraph("Código utiliza <code>'fallback_secret'</code> se <code>JWT_SECRET</code> não existir, e a chave esteve commitada no git.", body_style),
            Paragraph("Forja de tokens arbitrários com privilégio <code>Admin System</code>.", body_style)
        ],
        [
            Paragraph("<b>Vazamento de Chave no Vite</b><br/><code>vite.config.ts:28-32</code>", body_style),
            Paragraph("Vite compila <code>process.env.API_KEY</code> com a chave real da Gemini no bundle estático do frontend.", body_style),
            Paragraph("Chave de API do Google Gemini acessível publicamente a qualquer visitante do site.", body_style)
        ],
        [
            Paragraph("<b>IDOR em Transações Pix</b><br/><code>getPaymentStatus</code>", body_style),
            Paragraph("Rota de consulta de pagamento não valida posse de usuário e aceita chamadas não autenticadas.", body_style),
            Paragraph("Exposição de transações financeiras, QR Codes Pix e datas de pagamento.", body_style)
        ]
    ]
    weak_table = Table(weak_points_data, colWidths=[usable_width*0.28, usable_width*0.44, usable_width*0.28])
    weak_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7F1D1D')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BOX', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [COLOR_CARD_BG, COLOR_LIGHT_BG])
    ]))
    story.append(weak_table)
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════════
    # PÁGINA 4: TABELA CONSOLIDADA DE ACHADOS (COM CHIPS CORRIGIDOS)
    # ════════════════════════════════════════════════════════════════
    story.append(Paragraph("4. TABELA CONSOLIDADA DE ACHADOS POR CATEGORIA", h1_style))
    story.append(Paragraph(
        "A tabela a seguir consolida todos os achados com seu arquivo, linha exata, severidade ponderada e "
        "descrição técnica do vetor de exploração:",
        body_style
    ))
    story.append(Spacer(1, 2*mm))

    findings_summary = [
        [
            Paragraph("<b>Sev.</b>", body_bold),
            Paragraph("<b>Cat.</b>", body_bold),
            Paragraph("<b>Arquivo : Linhas</b>", body_bold),
            Paragraph("<b>Vulnerabilidade / Descrição Técnica do Achado</b>", body_bold)
        ],
        [
            Paragraph("<b>CRÍT</b>", badge_style),
            Paragraph("1 e 3", body_style),
            Paragraph("<code>backend/src/controllers/payment.controller.ts:101-106, 283-287</code>", body_style),
            Paragraph("<b>BOLA / Account Takeover via Checkout:</b> O endpoint assume usuário existente via <code>email</code> sem auth e emite JWT da vítima no response.", body_style)
        ],
        [
            Paragraph("<b>CRÍT</b>", badge_style),
            Paragraph("2 e 3", body_style),
            Paragraph("<code>backend/src/controllers/auth.controller.ts:380-417</code>", body_style),
            Paragraph("<b>Redefinição Arbitrária de Senhas:</b> <code>POST /api/auth/reset-password</code> altera senha de qualquer usuário por e-mail sem verificação e devolve JWT.", body_style)
        ],
        [
            Paragraph("<b>CRÍT</b>", badge_style),
            Paragraph("4", body_style),
            Paragraph("<code>backend/src/middleware/auth.middleware.ts:7</code><br/><code>backend/src/controllers/auth.controller.ts:11</code>", body_style),
            Paragraph("<b>Segredo JWT com Fallback Inseguro e Chave Exposta no Git:</b> Fallback <code>'fallback_secret'</code> e histórico git contém <code>editorial_architect_secret_key_2026</code>.", body_style)
        ],
        [
            Paragraph("<b>ALTA</b>", badge_style),
            Paragraph("1 e 3", body_style),
            Paragraph("<code>backend/src/controllers/payment.controller.ts:322-396</code>", body_style),
            Paragraph("<b>IDOR em Status de Pagamentos:</b> <code>GET /api/payments/:id/status</code> aceita qualquer ID sem autenticação nem filtro por <code>userId</code>, vazando dados Pix.", body_style)
        ],
        [
            Paragraph("<b>ALTA</b>", badge_style),
            Paragraph("4", body_style),
            Paragraph("<code>frontend/vite.config.ts:18, 28-32</code>", body_style),
            Paragraph("<b>Exposição de Chave de API Gemini no Bundle JS do Vite:</b> Configuração <code>define: 'process.env.API_KEY'</code> baka segredo no código cliente.", body_style)
        ],
        [
            Paragraph("<b>ALTA</b>", badge_style),
            Paragraph("4", body_style),
            Paragraph("<code>backend/prisma/seed.ts:208-227</code>", body_style),
            Paragraph("<b>Credencial Padrão de Super Administrador:</b> População de banco cria conta <code>editor@elite.com</code> com senha <code>'senha123'</code> e role <code>Admin System</code>.", body_style)
        ],
        [
            Paragraph("<b>ALTA</b>", badge_style),
            Paragraph("4", body_style),
            Paragraph("<code>backend/src/controllers/payment.controller.ts:472</code>", body_style),
            Paragraph("<b>Bypass de Autenticação em Webhook Asaas:</b> Condição <code>configuredToken && webhookToken !== configuredToken</code> passa sem auth se variável for nula.", body_style)
        ],
        [
            Paragraph("<b>MÉD</b>", badge_style),
            Paragraph("2", body_style),
            Paragraph("<code>backend/src/controllers/project.controller.ts:6-43, 90-126</code>", body_style),
            Paragraph("<b>Bypass de Restrições Comerciais de Plano (White-Label):</b> Backend não valida flag <code>hasWhiteLabel</code> ao gravar <code>companyName</code> no projeto.", body_style)
        ],
        [
            Paragraph("<b>BAIX</b>", badge_style),
            Paragraph("5", body_style),
            Paragraph("<code>backend/src/lib/validators.ts:44-47</code>", body_style),
            Paragraph("<b>Sanitização Incompleta de Strings:</b> Método <code>sanitizeString</code> apenas executa <code>.trim()</code> sem higienizar caracteres especiais HTML.", body_style)
        ],
        [
            Paragraph("<b>BAIX</b>", badge_style),
            Paragraph("5", body_style),
            Paragraph("<code>frontend/components/DocumentPreview.tsx:180-188</code>", body_style),
            Paragraph("<b>Ausência de Validação de Protocolo em Watermark:</b> Prop <code>watermarkImage</code> aceita URIs arbitrárias sem restrição de protocolo ou MIME type.", body_style)
        ]
    ]
    findings_table = Table(findings_summary, colWidths=[usable_width*0.10, usable_width*0.10, usable_width*0.35, usable_width*0.45])
    findings_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BOX', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        # Zebra para colunas 1 a -1
        ('ROWBACKGROUNDS', (1, 1), (-1, -1), [COLOR_CARD_BG, COLOR_LIGHT_BG]),
        # Fundos vibrantes dos Chips na coluna 0 aplicados DEPOIS
        ('BACKGROUND', (0, 1), (0, 3), COLOR_CRITICA),
        ('BACKGROUND', (0, 4), (0, 7), COLOR_ALTA),
        ('BACKGROUND', (0, 8), (0, 8), COLOR_MEDIA),
        ('BACKGROUND', (0, 9), (0, 10), COLOR_BAIXA),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),
    ]))
    story.append(findings_table)
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════════
    # PÁGINA 5: DETALHAMENTO TÉCNICO — ACHADOS CRÍTICOS
    # ════════════════════════════════════════════════════════════════
    story.append(Paragraph("<b>Detalhamento Técnico dos Achados Críticos (Severidade Máxima):</b>", h1_style))
    story.append(Spacer(1, 2*mm))

    # Achado 1
    story.append(Paragraph("<b>[CRÍTICA] SEC-01: Tomada de Conta de Qualquer Usuário via Checkout (BOLA / Broken Auth)</b>", h2_style))
    story.append(Paragraph("<b>Arquivo:</b> <code>editorial-backend/src/controllers/payment.controller.ts:101-106, 283-287</code>", body_style))
    story.append(Paragraph(
        "<code>if (!user &amp;&amp; userEmail) {\n  user = await prisma.user.findUnique({ where: { email: userEmail } });\n}\n...\nconst userToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });\nreturn res.json({ token: userToken, ... });</code>",
        code_style
    ))
    story.append(Paragraph(
        "<b>Por que é explorável:</b> O endpoint <code>POST /api/payments/subscribe</code> utiliza <code>optionalAuthenticateToken</code>. "
        "Se um atacante não autenticado enviar qualquer requisição de assinatura contendo o e-mail de uma vítima (incluindo o e-mail do administrador "
        "<code>editor@elite.com</code>), o backend localiza o usuário existente, sobrescreve seus dados cadastrais (telefone, CPF) e gera um token JWT "
        "assinado válido por 7 dias, devolvendo-o diretamente no corpo da resposta HTTP. O atacante ganha acesso completo imediato à conta.",
        body_style
    ))
    story.append(Spacer(1, 3*mm))

    # Achado 2
    story.append(Paragraph("<b>[CRÍTICA] SEC-02: Redefinição Arbitrária de Senha sem Autenticação (Account Takeover)</b>", h2_style))
    story.append(Paragraph("<b>Arquivo:</b> <code>editorial-backend/src/controllers/auth.controller.ts:380-417</code>", body_style))
    story.append(Paragraph(
        "<code>const user = await prisma.user.findUnique({ where: { email: String(email).trim() } });\n...\nconst senhaHash = await bcrypt.hash(novaSenha, SALT_ROUNDS);\nawait prisma.user.update({ where: { id: user.id }, data: { passwordHash: senhaHash } });\nconst token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);\nreturn res.json({ token });</code>",
        code_style
    ))
    story.append(Paragraph(
        "<b>Por que é explorável:</b> A rota <code>POST /api/auth/reset-password</code> é totalmente pública. Ela não exige a senha anterior, "
        "não envia código OTP para o e-mail e não valida nenhum token temporário assinado. Qualquer atacante que saiba o e-mail de um usuário "
        "pode redefinir sua senha para um valor arbitrário e receber um token JWT na mesma requisição para autenticar imediatamente.",
        body_style
    ))
    story.append(Spacer(1, 3*mm))

    # Achado 3
    story.append(Paragraph("<b>[CRÍTICA] SEC-03: Segredo JWT Fallback Hardcoded e Exposição Prévia no Histórico Git</b>", h2_style))
    story.append(Paragraph("<b>Arquivo:</b> <code>editorial-backend/src/middleware/auth.middleware.ts:7</code> | Commit <code>2bdfcf8</code>", body_style))
    story.append(Paragraph(
        "<code>const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';</code>",
        code_style
    ))
    story.append(Paragraph(
        "<b>Por que é explorável:</b> Se a variável <code>JWT_SECRET</code> for omitida no ambiente de produção (ou se falhar ao carregar via dotenv), "
        "o servidor assume silenciosamente <code>'fallback_secret'</code>. Um atacante pode forjar tokens JWT contendo <code>{ id: 'qualquer-id', role: 'Admin System' }</code>. "
        "Além disso, no commit <code>2bdfcf8f98164f1a8e9444fae18aaba26e20b807^</code>, o arquivo <code>.env</code> com <code>editorial_architect_secret_key_2026</code> "
        "foi versionado e permanece no histórico do repositório Git.",
        body_style
    ))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════════
    # PÁGINA 6: DETALHAMENTO TÉCNICO — ACHADOS ALTOS E MÉDIOS
    # ════════════════════════════════════════════════════════════════
    story.append(Paragraph("<b>Detalhamento Técnico dos Achados de Severidade Alta e Média:</b>", h1_style))
    story.append(Spacer(1, 2*mm))

    # Achado 4
    story.append(Paragraph("<b>[ALTA] SEC-04: IDOR e Vazamento de Dados Financeiros em Status de Pagamento</b>", h2_style))
    story.append(Paragraph("<b>Arquivo:</b> <code>editorial-backend/src/controllers/payment.controller.ts:322-396</code>", body_style))
    story.append(Paragraph(
        "<code>const paymentId = String(req.params.id);\nlet transaction = await prisma.paymentTransaction.findUnique({ where: { asaasPaymentId: paymentId } });\n...\nreturn res.json({ id: paymentId, status, pixQrCodeUrl, pixCopyPaste, ... });</code>",
        code_style
    ))
    story.append(Paragraph(
        "<b>Por que é explorável:</b> A rota <code>GET /api/payments/:id/status</code> utiliza <code>optionalAuthenticateToken</code> e aceita "
        "qualquer <code>paymentId</code> (Asaas ID) sem validar se a transação pertence ao usuário da requisição (<code>transaction.userId !== req.user?.id</code>). "
        "Permite inspecionar status de pagamento, links de QR Code Pix e chaves copia-e-cola de qualquer cliente. Além disso, força polling e atualização de plano.",
        body_style
    ))
    story.append(Spacer(1, 2*mm))

    # Achado 5
    story.append(Paragraph("<b>[ALTA] SEC-05: Exposição de Chave da API Google Gemini no Bundle Público do Vite</b>", h2_style))
    story.append(Paragraph("<b>Arquivo:</b> <code>editorial-frontend/vite.config.ts:18, 28-32</code>", body_style))
    story.append(Paragraph(
        "<code>const apiKey = env.VITE_GEMINI_API_KEY || env.API_KEY || '';\n...\ndefine: { 'process.env.API_KEY': JSON.stringify(apiKey) }</code>",
        code_style
    ))
    story.append(Paragraph(
        "<b>Por que é explorável:</b> A diretiva <code>define</code> do Vite substitui em tempo de compilação qualquer menção a <code>process.env.API_KEY</code> "
        "pelo valor em texto claro da chave contida no arquivo <code>.env.local</code>. Ao compilar com <code>pnpm build</code>, a chave de produção do Gemini "
        "é embutida nos arquivos JavaScript distribuídos publicamente no diretório <code>dist/assets/</code>.",
        body_style
    ))
    story.append(Spacer(1, 2*mm))

    # Achado 6
    story.append(Paragraph("<b>[ALTA] SEC-06: Credencial Padrão de Super Administrador Criada no Seed</b>", h2_style))
    story.append(Paragraph("<b>Arquivo:</b> <code>editorial-backend/prisma/seed.ts:208-227</code>", body_style))
    story.append(Paragraph(
        "<code>const emailPadrao = 'editor@elite.com';\nconst senhaHash = await bcrypt.hash('senha123', 10);\nawait prisma.user.create({ data: { email: emailPadrao, passwordHash: senhaHash, roleId: dbRoles['Admin System'].id } });</code>",
        code_style
    ))
    story.append(Paragraph(
        "<b>Por que é explorável:</b> O script de seed popula uma conta de Super Administrador (<code>Admin System</code>) com a senha estática previsível "
        "<code>'senha123'</code>. Ambientes de homologação, staging ou produção onde o seed for executado ficam imediatamente vulneráveis a login administrativo não autorizado.",
        body_style
    ))
    story.append(Spacer(1, 2*mm))

    # Achado 7
    story.append(Paragraph("<b>[ALTA] SEC-07: Bypass da Validação de Token de Webhook do Asaas por Variável Nula</b>", h2_style))
    story.append(Paragraph("<b>Arquivo:</b> <code>editorial-backend/src/controllers/payment.controller.ts:472</code>", body_style))
    story.append(Paragraph(
        "<code>if (configuredToken &amp;&amp; webhookToken !== configuredToken) {\n  return res.status(401).json({ error: 'Token de webhook inválido' });\n}</code>",
        code_style
    ))
    story.append(Paragraph(
        "<b>Por que é explorável:</b> Se a variável <code>ASAAS_WEBHOOK_TOKEN</code> não for preenchida no ambiente do servidor, <code>configuredToken</code> "
        "avalia para <code>undefined</code> (falso). A condição de segurança é ignorada e qualquer atacante externo pode enviar notificações falsas "
        "de <code>PAYMENT_CONFIRMED</code> para <code>/api/webhooks/asaas</code>, ativando planos pagos sem nenhum desembolso financeiro.",
        body_style
    ))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════════
    # PÁGINA 7: RECOMENDAÇÕES PRIORIZADAS
    # ════════════════════════════════════════════════════════════════
    story.append(Paragraph("5. RECOMENDAÇÕES PRIORIZADAS & PLANO DE REMEDIAÇÃO", h1_style))
    story.append(Paragraph(
        "As medidas de correção foram divididas em 3 níveis de prioridade com base na severidade e na probabilidade de exploração remota:",
        body_style
    ))
    story.append(Spacer(1, 2*mm))

    rec_data = [
        [
            Paragraph("<b>Prioridade</b>", body_bold),
            Paragraph("<b>Ações Técnicas Imediatas</b>", body_bold),
            Paragraph("<b>Arquivos Alvo & Correção</b>", body_bold)
        ],
        [
            Paragraph("<font color='#B91C1C'><b>P1 — URGENTE</b></font><br/>(24h - 48h)", body_bold),
            Paragraph(
                "<b>1. Corrigir Account Takeover no Checkout:</b> Se o e-mail já pertencer a outro usuário e a requisição não tiver token do mesmo, rejeitar com 409 Conflict ou exigir login prévio.<br/>"
                "<b>2. Blindar o Reset de Senha:</b> Implementar fluxo com envio de token criptográfico temporário por e-mail (válido por 15 min) com hash salvo no banco.<br/>"
                "<b>3. Remover Fallbacks de JWT:</b> Adicionar validação no startup do servidor: rejeitar inicialização se <code>JWT_SECRET</code> não estiver definido ou for fraco.<br/>"
                "<b>4. Rotacionar Segredo JWT e Chaves:</b> Rotacionar o JWT_SECRET e a chave do Gemini devido à exposição no Git e no Vite.",
                body_style
            ),
            Paragraph(
                "<code>payment.controller.ts:101</code><br/>"
                "<code>auth.controller.ts:380</code><br/>"
                "<code>auth.middleware.ts:7</code><br/>"
                "<code>server.ts:40</code>",
                body_style
            )
        ],
        [
            Paragraph("<font color='#EA580C'><b>P2 — CURTO PRAZO</b></font><br/>(1 semana)", body_bold),
            Paragraph(
                "<b>5. Corrigir IDOR de Pagamento:</b> Exigir autenticação obrigatória em <code>/api/payments/:id/status</code> e validar <code>where: { asaasPaymentId: id, userId: req.user.id }</code>.<br/>"
                "<b>6. Limpar vite.config.ts:</b> Remover injeção de <code>process.env.API_KEY</code> no frontend, mantendo as chamadas à IA restritas ao backend.<br/>"
                "<b>7. Remover Credenciais Padrão do Seed:</b> Gerar senha aleatória segura no seed ou ler de variáveis de ambiente para inicialização de administradores.<br/>"
                "<b>8. Travar Webhook sem Token:</b> Rejeitar webhooks se <code>ASAAS_WEBHOOK_TOKEN</code> não estiver configurado no servidor (falha segura por padrão).",
                body_style
            ),
            Paragraph(
                "<code>payment.controller.ts:322</code><br/>"
                "<code>vite.config.ts:28</code><br/>"
                "<code>prisma/seed.ts:214</code><br/>"
                "<code>payment.controller.ts:472</code>",
                body_style
            )
        ],
        [
            Paragraph("<font color='#D97706'><b>P3 — MÉDIO PRAZO</b></font><br/>(2 semanas)", body_bold),
            Paragraph(
                "<b>9. Validação de Limites de Plano no Backend:</b> Criar validação em <code>project.controller.ts</code> para impedir custom branding (white-label) se o plano do usuário não permitir.<br/>"
                "<b>10. Sanitização e Validação Rígida:</b> Utilizar biblioteca de sanitização/validação (Zod / DOMPurify) e validar esquemas de URLs para imagens personalizadas.",
                body_style
            ),
            Paragraph(
                "<code>rbac.middleware.ts</code><br/>"
                "<code>validators.ts</code><br/>"
                "<code>DocumentPreview.tsx</code>",
                body_style
            )
        ]
    ]
    rec_table = Table(rec_data, colWidths=[usable_width*0.22, usable_width*0.52, usable_width*0.26])
    rec_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BOX', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [COLOR_CARD_BG, COLOR_LIGHT_BG])
    ]))
    story.append(rec_table)
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════════
    # PÁGINAS 8+: SEÇÃO DE ISSUES PARA O GITHUB
    # ════════════════════════════════════════════════════════════════
    story.append(Paragraph("6. ISSUES PARA O GITHUB (TEXTO COMPLETO PRONTO PARA COPIAR E COLAR)", h1_style))
    story.append(Paragraph(
        "Abaixo estão os templates completos em formato Markdown de cada issue acionável identificada na auditoria. "
        "Cada bloco está delimitado individualmente entre <code>--- ISSUE n ---</code> e <code>--- FIM ISSUE n ---</code>.",
        body_style
    ))
    story.append(Spacer(1, 2*mm))

    issues = [
        {
            "id": 1,
            "title": "[Segurança] [Crítica] Account Takeover no Checkout de Assinaturas (subscribePlan)",
            "content": """--- ISSUE 1 ---
### [Segurança] [Crítica] Account Takeover no Checkout de Assinaturas (subscribePlan)
**Labels sugeridas:** `security`, `severity: critical`, `backend`

#### Descrição do Problema
O endpoint `POST /api/payments/subscribe` (`backend/src/controllers/payment.controller.ts`) permite que uma requisição não autenticada envie qualquer e-mail no corpo da requisição (`req.body.email`). Se o e-mail já existir no banco de dados, o backend assume o registro da vítima sem validar sessão ou credenciais, atualiza dados cadastrais e assina um token JWT em nome da vítima, retornando-o no response HTTP.

#### Evidência
- **Arquivo:** `editorial-backend/src/controllers/payment.controller.ts` (Linhas 101-106 e 283-287)
```typescript
if (!user && userEmail) {
    user = await prisma.user.findUnique({
        where: { email: userEmail },
        include: { plan: true }
    });
}
// ...
const userToken = jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
);
return res.json({ message: '...', token: userToken });
```

#### Impacto
Tomada total de conta (Account Takeover) de qualquer usuário da plataforma, incluindo o Super Admin (`editor@elite.com`), apenas enviando seu e-mail no formulário de checkout.

#### Sugestão de Correção
Se o e-mail informado já existir no banco de dados:
1. Se a requisição não possuir um token JWT válido pertencente àquele usuário, rejeitar a requisição com HTTP `409 Conflict` e instruir o usuário a fazer login antes de alterar sua assinatura.
2. Nunca emitir tokens JWT para requisições anônimas em contas pré-existentes.

#### Critérios de Aceite
- [ ] Requisições para `/api/payments/subscribe` com e-mail já cadastrado sem autenticação retornam HTTP 409.
- [ ] Usuários autenticados só podem assinar planos para o seu próprio `req.user.id`.
- [ ] Testes automatizados cobrindo tentativa de subscrição anônima em e-mail de terceiro.
--- FIM ISSUE 1 ---"""
        },
        {
            "id": 2,
            "title": "[Segurança] [Crítica] Redefinição Arbitrária de Senha sem Autenticação (resetPassword)",
            "content": """--- ISSUE 2 ---
### [Segurança] [Crítica] Redefinição Arbitrária de Senha sem Autenticação (resetPassword)
**Labels sugeridas:** `security`, `severity: critical`, `backend`, `auth`

#### Descrição do Problema
O endpoint público `POST /api/auth/reset-password` (`backend/src/controllers/auth.controller.ts`) recebe `email` e `novaSenha`, localiza o usuário diretamente pelo e-mail e substitui o hash da senha imediatamente no banco, gerando em seguida um token de sessão JWT e retornando-o ao chamador. Não há envio de link por e-mail, nem código OTP, nem validação de senha anterior.

#### Evidência
- **Arquivo:** `editorial-backend/src/controllers/auth.controller.ts` (Linhas 392-408)
```typescript
const user = await prisma.user.findUnique({ where: { email: String(email).trim() } });
// ...
const senhaHash = await bcrypt.hash(novaSenha, SALT_ROUNDS);
await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: senhaHash }
});
const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
return res.json({ message: 'Senha atualizada com sucesso!', token });
```

#### Impacto
Qualquer visitante da internet pode alterar a senha de qualquer conta do sistema e autenticar-se imediatamente.

#### Sugestão de Correção
Implementar fluxo seguro de redefinição de senha em duas etapas:
1. Endpoint `forgot-password` gera um token aleatório criptograficamente seguro (`crypto.randomBytes`), salva o hash com expiração (15 min) e envia link único por e-mail.
2. Endpoint `reset-password` exige o token recebido por e-mail para permitir o cadastro da nova senha.

#### Critérios de Aceite
- [ ] Endpoint não aceita troca direta de senha sem token de redefinição validado.
- [ ] Tokens de redefinição possuem expiração máxima de 15 minutos e uso único.
- [ ] Não é possível autenticar nem receber JWT sem validação de e-mail.
--- FIM ISSUE 2 ---"""
        },
        {
            "id": 3,
            "title": "[Segurança] [Crítica] Segredo JWT Hardcoded como Fallback e Chave Exposta no Git",
            "content": """--- ISSUE 3 ---
### [Segurança] [Crítica] Segredo JWT Hardcoded como Fallback e Chave Exposta no Git
**Labels sugeridas:** `security`, `severity: critical`, `backend`, `config`

#### Descrição do Problema
Em múltiplos arquivos (`auth.middleware.ts`, `auth.controller.ts`, `payment.controller.ts`), a constante `JWT_SECRET` utiliza a string estática `'fallback_secret'` caso a variável de ambiente não esteja presente. Além disso, a chave `editorial_architect_secret_key_2026` esteve commitada no histórico do repositório Git (commit `2bdfcf8`).

#### Evidência
- **Arquivo:** `editorial-backend/src/middleware/auth.middleware.ts` (Linha 7)
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
```
- **Git Commit:** `2bdfcf8f98164f1a8e9444fae18aaba26e20b807^:.env`

#### Impacto
Possibilidade de forja de tokens JWT válidos com perfil `Admin System` ou qualquer identidade por atacantes externos que conheçam o segredo público.

#### Sugestão de Correção
1. Adicionar validação estrita na inicialização do servidor (`server.ts`): abortar a inicialização caso `process.env.JWT_SECRET` esteja ausente ou seja menor que 32 caracteres.
2. Remover fallbacks inseguros (`|| 'fallback_secret'`).
3. Rotacionar imediatamente o segredo de produção nas variáveis de ambiente da Railway.

#### Critérios de Aceite
- [ ] A aplicação encerra o processo (`process.exit(1)`) se `JWT_SECRET` for nulo ou inválido.
- [ ] O segredo antigo foi revogado e substituído em produção por string de alta entropia.
- [ ] Nenhuma menção a `'fallback_secret'` em código-fonte.
--- FIM ISSUE 3 ---"""
        },
        {
            "id": 4,
            "title": "[Segurança] [Alta] IDOR e Vazamento de Dados Pix em Polling de Pagamentos",
            "content": """--- ISSUE 4 ---
### [Segurança] [Alta] IDOR e Vazamento de Dados Pix em Polling de Pagamentos
**Labels sugeridas:** `security`, `severity: high`, `backend`, `idor`

#### Descrição do Problema
A rota `GET /api/payments/:id/status` aceita chamadas não autenticadas ou com qualquer token e busca a transação diretamente pelo ID do gateway (`asaasPaymentId`) sem checar se a transação pertence ao `req.user.id`.

#### Evidência
- **Arquivo:** `editorial-backend/src/controllers/payment.controller.ts` (Linhas 324-334)
```typescript
const paymentId = String(req.params.id);
let transaction = await prisma.paymentTransaction.findUnique({
    where: { asaasPaymentId: paymentId }
});
// Retorna pixQrCodeUrl, pixCopyPaste, status e paymentDate sem checar transaction.userId
```

#### Impacto
Vazamento de dados financeiros de outros assinantes, código Copia e Cola Pix e possibilidade de forçar polling e alteração de status no banco de dados.

#### Sugestão de Correção
1. Exigir autenticação via `authenticateToken`.
2. Validar que a transação pertence ao usuário autenticado: `transaction.userId === req.user.id` (ou perfil com permissão de leitura de finanças/admin).

#### Critérios de Aceite
- [ ] A rota rejeita requisições não autenticadas com HTTP 401.
- [ ] Usuários autenticados recebem HTTP 404/403 ao consultar transações de outros clientes.
--- FIM ISSUE 4 ---"""
        },
        {
            "id": 5,
            "title": "[Segurança] [Alta] Exposição da Chave Gemini no Bundle do Frontend via Vite",
            "content": """--- ISSUE 5 ---
### [Segurança] [Alta] Exposição da Chave Gemini no Bundle do Frontend via Vite
**Labels sugeridas:** `security`, `severity: high`, `frontend`, `secrets`

#### Descrição do Problema
O arquivo de configuração `vite.config.ts` utiliza a diretiva `define` para embutir a variável `process.env.API_KEY` diretamente nos artefatos compilados do cliente, expondo a chave de API do Gemini no JavaScript público da SPA.

#### Evidência
- **Arquivo:** `editorial-frontend/vite.config.ts` (Linhas 18 e 28-32)
```typescript
const apiKey = env.VITE_GEMINI_API_KEY || env.API_KEY || "";
// ...
define: {
  'process.env.API_KEY': JSON.stringify(apiKey),
  'process.env': {
    NODE_ENV: JSON.stringify(mode),
    API_KEY: JSON.stringify(apiKey)
  }
}
```

#### Impacto
Qualquer visitante pode inspecionar os arquivos JS no navegador e extrair a chave de API do Gemini, consumindo cotas ou gerando custos financeiros indevidos.

#### Sugestão de Correção
1. Remover a injeção de `API_KEY` do `vite.config.ts`.
2. Manter todas as chamadas de IA restritas ao endpoint backend `/api/ai/generate`.
3. Rotacionar a chave do Gemini no painel do Google AI Studio.

#### Critérios de Aceite
- [ ] O bundle em `dist/assets/*.js` não contém chaves de API nem menções a chaves do Gemini.
- [ ] Chave antiga revogada no Google Cloud / AI Studio.
--- FIM ISSUE 5 ---"""
        },
        {
            "id": 6,
            "title": "[Segurança] [Alta] Credencial Previsível de Administrador no Seed e Falha de Validação em Webhook",
            "content": """--- ISSUE 6 ---
### [Segurança] [Alta] Credencial Previsível de Administrador no Seed e Falha de Validação em Webhook
**Labels sugeridas:** `security`, `severity: high`, `backend`, `config`

#### Descrição do Problema
1. O seed do Prisma cria a conta `editor@elite.com` com senha `'senha123'` e permissões de Super Admin (`Admin System`).
2. O controlador de webhook (`payment.controller.ts`) possui uma condição de verificação de token que não bloqueia requisições se a variável `ASAAS_WEBHOOK_TOKEN` for nula.

#### Evidência
- **Arquivo:** `editorial-backend/prisma/seed.ts` (Linhas 214-226)
- **Arquivo:** `editorial-backend/src/controllers/payment.controller.ts` (Linha 472)
```typescript
if (configuredToken && webhookToken !== configuredToken) { ... }
```

#### Impacto
Comprometimento administrativo em novas instalações e possibilidade de falsificação de pagamentos para liberação ilimitada de planos se o webhook token não estiver preenchido.

#### Sugestão de Correção
1. Modificar `seed.ts` para ler a senha de `process.env.INITIAL_ADMIN_PASSWORD` ou gerar senha aleatória exibida apenas no console durante o setup inicial.
2. Exigir explicitamente que `configuredToken` exista e rejeitar requisições de webhook com 500/401 caso não esteja configurado:
```typescript
if (!configuredToken || webhookToken !== configuredToken) {
    return res.status(401).json({ error: 'Webhook não autorizado' });
}
```

#### Critérios de Aceite
- [ ] A execução do seed não define credenciais estáticas óbvias.
- [ ] A rota de webhook rejeita chamadas se `ASAAS_WEBHOOK_TOKEN` não estiver configurado.
--- FIM ISSUE 6 ---"""
        }
    ]

    for issue in issues:
        story.append(KeepTogether([
            Paragraph(f"<b>Issue #{issue['id']} — {issue['title']}</b>", h2_style),
            Paragraph(issue['content'].replace('\n', '<br/>'), issue_block_style),
            Spacer(1, 2*mm)
        ]))

    # Build PDF
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"[OK] Relatório PDF gerado com sucesso em: {output_pdf}")
    return output_pdf


if __name__ == '__main__':
    build_pdf()

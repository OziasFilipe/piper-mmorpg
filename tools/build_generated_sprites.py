"""Normaliza as folhas de arte geradas para os tamanhos usados pelo jogo.

Uso:
  python tools/build_generated_sprites.py --warrior ARTE.png --mage ARTE.png --monsters ARTE.png
"""
from argparse import ArgumentParser
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CHARS = ROOT / 'public' / 'assets' / 'chars'
ENEMIES = ROOT / 'public' / 'assets' / 'enemies'


def crop_cell(image, col, row, columns, rows, gutter=0):
    width, height = image.size
    box = (
        round(col * width / columns), round(row * height / rows),
        round((col + 1) * width / columns), round((row + 1) * height / rows),
    )
    # Model-generated atlas tiles sometimes have a few pixels of a neighbour
    # bleeding over the intended border. A small inner gutter preserves a
    # clean sprite silhouette without changing the actual character art.
    x0, y0, x1, y1 = box
    tile = image.crop((x0 + gutter, y0 + gutter, x1 - gutter, y1 - gutter))
    alpha = tile.getchannel('A')
    bbox = alpha.getbbox()
    return tile.crop(bbox) if bbox else tile


def fit(subject, width, height, padding=8):
    """Centraliza o recorte sem deformar a arte e preserva seus pixels transparentes."""
    max_w, max_h = width - padding * 2, height - padding * 2
    scale = min(max_w / subject.width, max_h / subject.height)
    size = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    # A arte desta variação é pixel art: interpolação suave cria um halo
    # indesejado quando o personagem é exibido sobre tiles pequenos.
    subject = subject.resize(size, Image.Resampling.NEAREST)
    canvas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    canvas.alpha_composite(subject, ((width - subject.width) // 2, height - padding - subject.height))
    return canvas


CHARACTER_FRAMES = 8
ENEMY_FRAMES = 8


def write_character_motion(rows, destination):
    """Cria oito poses ancoradas pela sola do pé em cada direção."""
    output = Image.new('RGBA', (128 * CHARACTER_FRAMES, 768), (0, 0, 0, 0))
    # repouso, quatro passadas, preparação, golpe e recuperação
    poses = (
        (0, 1.00, 1.00, 0, 0, 0),
        (1, 0.97, 1.03, -3, 1, 1.2),
        (1, 1.01, 0.99, -1, -1, .4),
        (2, 1.03, 0.97, 3, 1, -1.2),
        (2, 1.00, 1.01, 1, -1, -.4),
        (0, 0.94, 1.05, -5, 1, 3.0),
        (0, 1.09, 0.93, 7, -2, -4.2),
        (0, 1.02, 0.98, 3, 0, -1.5),
    )
    for row, cells in enumerate(rows):
        for frame, (source, sx, sy, dx, dy, angle) in enumerate(poses):
            output.alpha_composite(motion_pose(cells[source], sx, sy, dx, dy, angle, 128, 192, 185), (frame * 128, row * 192))
    output.save(destination, optimize=True)


def character_sheet(source, destination):
    atlas = Image.open(source).convert('RGBA')
    rows = []
    for row in range(4):
        rows.append([fit(crop_cell(atlas, col, row, 3, 4, gutter=6), 128, 192, padding=7) for col in range(3)])
    write_character_motion(rows, destination)


MONSTERS = {
    'wolf': (0, 0), 'goblin': (1, 0), 'rat': (2, 0),
    'spider': (0, 1), 'scorpion': (1, 1), 'snake': (2, 1), 'mummy': (3, 1),
    'skeleton': (0, 2), 'orc': (1, 2), 'shaman': (2, 2), 'troll': (3, 2),
    'bear': (0, 3), 'rabbit': (1, 3), 'dragon': (2, 3), 'dragon-boss': (3, 3),
}


def monster_motion_sheet(sprite, destination):
    """Oito poses: repouso, ciclo de corrida e ataque completo."""
    sheet = Image.new('RGBA', (256 * ENEMY_FRAMES, 256), (0, 0, 0, 0))
    poses = (
        (1.00, 1.00, 0, 0, 0),
        (0.97, 1.03, -6, 1, 2.0),
        (1.00, 1.00, -2, -2, .6),
        (1.03, 0.97, 6, 1, -2.0),
        (1.00, 1.01, 2, -1, -.6),
        (0.91, 1.09, -7, 2, 4.0),
        (1.15, 0.89, 13, -3, -5.8),
        (1.03, 0.98, 5, 0, -2.0),
    )
    for frame, pose in enumerate(poses):
        sheet.alpha_composite(motion_pose(sprite, *pose), (frame * 256, 0))
    sheet.save(destination, optimize=True)


def monster_sheets(source):
    atlas = Image.open(source).convert('RGBA')
    ENEMIES.mkdir(parents=True, exist_ok=True)
    for name, (col, row) in MONSTERS.items():
        sprite = fit(crop_cell(atlas, col, row, 4, 4, gutter=14), 256, 256, padding=12)
        if name == 'dragon':
            # The generated boss's wing slightly crossed into the dragon cell.
            # Its source lives in the next tile, so remove only that far edge.
            sprite.paste((0, 0, 0, 0), (224, 0, 256, 256))
        monster_motion_sheet(sprite, ENEMIES / f'{name}.png')


def world_props(source):
    """Recorta árvore, pedra e portal do atlas no mesmo traço dos sprites."""
    atlas = Image.open(source).convert('RGBA')
    world = ROOT / 'public' / 'assets' / 'world'
    world.mkdir(parents=True, exist_ok=True)
    tree = fit(crop_cell(atlas, 0, 0, 3, 1, gutter=12), 256, 256, padding=3)
    rock = fit(crop_cell(atlas, 1, 0, 3, 1, gutter=12), 128, 128, padding=4)
    gate = fit(crop_cell(atlas, 2, 0, 3, 1, gutter=12), 384, 288, padding=4)
    tree.save(world / 'oak-sm.png', optimize=True)
    rock.save(world / 'rock-sm.png', optimize=True)
    gate.save(world / 'hub-sm.png', optimize=True)


def motion_pose(sprite, scale_x, scale_y, shift_x, shift_y, angle, width=256, height=256, ground=244):
    """Cria um quadro de caminhada mantendo os pés ancorados no chão."""
    bbox = sprite.getchannel('A').getbbox()
    if not bbox:
        return sprite.copy()
    subject = sprite.crop(bbox)
    size = (max(1, round(subject.width * scale_x)), max(1, round(subject.height * scale_y)))
    subject = subject.resize(size, Image.Resampling.NEAREST)
    subject = subject.rotate(angle, resample=Image.Resampling.NEAREST, expand=True)
    # Depois da rotação, a caixa transparente aumenta. Ancorar pela borda
    # inferior visível (e não pela altura da caixa) impede o pé de flutuar.
    alpha_box = subject.getchannel('A').getbbox()
    frame = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    x = (width - subject.width) // 2 + shift_x
    y = ground - alpha_box[3]
    frame.alpha_composite(subject, (x, y))
    return frame


def main():
    parser = ArgumentParser()
    parser.add_argument('--warrior', type=Path)
    parser.add_argument('--mage', type=Path)
    parser.add_argument('--monsters', type=Path)
    parser.add_argument('--guard', type=Path)
    parser.add_argument('--blacksmith', type=Path)
    parser.add_argument('--healer', type=Path)
    parser.add_argument('--sage', type=Path)
    parser.add_argument('--props', type=Path)
    parser.add_argument('--refresh-motion', action='store_true', help='expande as folhas já existentes para 8 quadros de movimento')
    args = parser.parse_args()
    if args.refresh_motion:
        # Primeiro quadro de cada folha existente é a pose-base de melhor leitura.
        for source in CHARS.glob('body_*.png'):
            image = Image.open(source).convert('RGBA')
            if image.width < 384 or image.height != 768:
                continue
            rows = [[image.crop((col * 128, row * 192, (col + 1) * 128, (row + 1) * 192)) for col in range(3)] for row in range(4)]
            write_character_motion(rows, source)
        for source in ENEMIES.glob('*.png'):
            image = Image.open(source).convert('RGBA')
            if image.width < 256 or image.height != 256:
                continue
            monster_motion_sheet(image.crop((0, 0, 256, 256)), source)
        return
    if not (args.warrior and args.mage and args.monsters):
        parser.error('--warrior, --mage e --monsters são obrigatórios, exceto com --refresh-motion')
    CHARS.mkdir(parents=True, exist_ok=True)
    character_sheet(args.warrior, CHARS / 'hero-warrior.png')
    character_sheet(args.mage, CHARS / 'hero-wizard.png')
    # Substitui os três corpos legados que o carregador do jogo já conhece.
    # A pele não é mais uma recoloração separada: cada vocação usa uma folha
    # completa e coerente, com roupa, arma, pose e quatro direções.
    character_sheet(args.warrior, CHARS / 'body_0.png')
    character_sheet(args.mage, CHARS / 'body_1.png')
    character_sheet(args.warrior, CHARS / 'body_2.png')
    monster_sheets(args.monsters)
    npc_sheets = {
        'body_npc_guard.png': args.guard,
        'body_npc_blacksmith.png': args.blacksmith,
        'body_npc_healer.png': args.healer,
        'body_npc_sage.png': args.sage,
    }
    for filename, source in npc_sheets.items():
        if source:
            character_sheet(source, CHARS / filename)
    if args.props:
        world_props(args.props)


if __name__ == '__main__':
    main()

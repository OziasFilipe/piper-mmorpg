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


def character_sheet(source, destination):
    atlas = Image.open(source).convert('RGBA')
    output = Image.new('RGBA', (384, 768), (0, 0, 0, 0))
    for row in range(4):
        for col in range(3):
            sprite = fit(crop_cell(atlas, col, row, 3, 4, gutter=6), 128, 192, padding=7)
            output.alpha_composite(sprite, (col * 128, row * 192))
    output.save(destination, optimize=True)


MONSTERS = {
    'wolf': (0, 0), 'goblin': (1, 0), 'rat': (2, 0),
    'spider': (0, 1), 'scorpion': (1, 1), 'snake': (2, 1), 'mummy': (3, 1),
    'skeleton': (0, 2), 'orc': (1, 2), 'shaman': (2, 2), 'troll': (3, 2),
    'bear': (0, 3), 'rabbit': (1, 3), 'dragon': (2, 3), 'dragon-boss': (3, 3),
}


def monster_sheets(source):
    atlas = Image.open(source).convert('RGBA')
    ENEMIES.mkdir(parents=True, exist_ok=True)
    for name, (col, row) in MONSTERS.items():
        sprite = fit(crop_cell(atlas, col, row, 4, 4, gutter=14), 256, 256, padding=12)
        if name == 'dragon':
            # The generated boss's wing slightly crossed into the dragon cell.
            # Its source lives in the next tile, so remove only that far edge.
            sprite.paste((0, 0, 0, 0), (224, 0, 256, 256))
        # Cinco poses: repouso, dois passos, preparação e golpe. Isso dá ao
        # renderer quadros próprios para caminhada e ataque, sem trocar de
        # estilo entre os monstros.
        sheet = Image.new('RGBA', (1280, 256), (0, 0, 0, 0))
        poses = (
            (1.0, 1.0, 0, 0, 0),
            (0.96, 1.04, -7, -1, 2.4),
            (1.04, 0.97, 7, 2, -2.4),
            (0.91, 1.08, -5, 2, 3.8),
            (1.12, 0.91, 12, -3, -5.5),
        )
        for frame, pose in enumerate(poses):
            sheet.alpha_composite(motion_pose(sprite, *pose), (frame * 256, 0))
        sheet.save(ENEMIES / f'{name}.png', optimize=True)


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


def motion_pose(sprite, scale_x, scale_y, shift_x, shift_y, angle):
    """Cria um quadro de caminhada mantendo os pés ancorados no chão."""
    bbox = sprite.getchannel('A').getbbox()
    if not bbox:
        return sprite.copy()
    subject = sprite.crop(bbox)
    size = (max(1, round(subject.width * scale_x)), max(1, round(subject.height * scale_y)))
    subject = subject.resize(size, Image.Resampling.NEAREST)
    subject = subject.rotate(angle, resample=Image.Resampling.NEAREST, expand=True)
    frame = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    x = (256 - subject.width) // 2 + shift_x
    y = 244 - subject.height + shift_y
    frame.alpha_composite(subject, (x, y))
    return frame


def main():
    parser = ArgumentParser()
    parser.add_argument('--warrior', type=Path, required=True)
    parser.add_argument('--mage', type=Path, required=True)
    parser.add_argument('--monsters', type=Path, required=True)
    parser.add_argument('--guard', type=Path)
    parser.add_argument('--blacksmith', type=Path)
    parser.add_argument('--healer', type=Path)
    parser.add_argument('--sage', type=Path)
    parser.add_argument('--props', type=Path)
    args = parser.parse_args()
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

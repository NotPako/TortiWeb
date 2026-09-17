import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { Tortilla } from '@/models/Tortilla';
import { Comment } from '@/models/Comment';
import { User, userImageUrl } from '@/models/User';
import { MAX_COMMENT_LENGTH, normalizeCommentText } from '@/lib/comments';
import { requireUser, type GqlContext } from './context';
import { requireGroupAccess } from './access';

const COMMENT_NOT_FOUND = 'Comentario no encontrado.';

export const commentMutations = {
  async addComment(
    _: unknown,
    args: { input: { tortillaId: string; text: string } },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    requireUser(ctx, 'Debes iniciar sesión para comentar.');
    if (!Types.ObjectId.isValid(args.input.tortillaId)) {
      throw new Error('ID de tortilla inválido.');
    }
    const text = normalizeCommentText(args.input.text);
    if (!text) throw new Error('El comentario no puede estar vacío.');
    if (text.length > MAX_COMMENT_LENGTH) {
      throw new Error(
        `El comentario no puede superar ${MAX_COMMENT_LENGTH} caracteres.`
      );
    }

    const tortilla = await Tortilla.findById(args.input.tortillaId)
      .select('_id group')
      .exec();
    if (!tortilla) throw new Error('Tortilla no encontrada.');
    const { group, user } = await requireGroupAccess(
      ctx,
      { id: tortilla.group },
      'Tortilla no encontrada.'
    );

    const doc = await Comment.create({
      tortilla: tortilla._id,
      group: group._id,
      userKey: user.userKey,
      userName: user.userName,
      text,
    });

    // Resolvemos la imagen del autor para mantener simetría con el resolver.
    const userDoc = await User.findOne({ usernameKey: user.userKey })
      .select('image imageKey')
      .exec();
    const imageUrl = userDoc ? userImageUrl(userDoc) : null;

    return {
      id: (doc._id as Types.ObjectId).toString(),
      userName: doc.userName,
      text: doc.text,
      createdAt: doc.createdAt,
      imageUrl,
      isMine: true,
    };
  },

  async deleteComment(_: unknown, args: { id: string }, ctx: GqlContext) {
    await connectToDatabase();
    const me = requireUser(ctx);
    if (!Types.ObjectId.isValid(args.id)) {
      throw new Error('ID de comentario inválido.');
    }
    const doc = await Comment.findById(args.id).exec();
    if (!doc) throw new Error(COMMENT_NOT_FOUND);
    await requireGroupAccess(ctx, { id: doc.group }, COMMENT_NOT_FOUND);
    if (doc.userKey !== me.userKey) {
      throw new Error('Sólo puedes borrar tus propios comentarios.');
    }
    await doc.deleteOne();
    return true;
  },
};

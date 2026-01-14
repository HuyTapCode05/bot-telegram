async function getGroupInfo(ctx) {
  const chat = ctx.chat;
  if (!chat) throw new Error('not-in-group');
  const chatId = chat.id;
  const chatInfo = await ctx.telegram.getChat(chatId);

  // get member count
  let memberCount = null;
  try {
    if (typeof ctx.telegram.getChatMemberCount === 'function') memberCount = await ctx.telegram.getChatMemberCount(chatId);
    else if (typeof ctx.telegram.getChatMembersCount === 'function') memberCount = await ctx.telegram.getChatMembersCount(chatId);
    else {
      try { const info = await ctx.getChat(); memberCount = info && (info.members_count || info.member_count || null); } catch (e) { memberCount = null; }
    }
  } catch (e) { memberCount = null; }

  // get admins
  let admins = [];
  try { admins = typeof ctx.telegram.getChatAdministrators === 'function' ? await ctx.telegram.getChatAdministrators(chatId) : []; } catch (e) { admins = []; }

  const owner = admins.find(a => a.status === 'creator');

  return {
    chatId,
    title: chatInfo.title || chatInfo.first_name || '',
    type: chatInfo.type || 'group',
    description: chatInfo.description || chatInfo.bio || '',
    memberCount,
    admins,
    owner
  };
}

module.exports = { getGroupInfo };

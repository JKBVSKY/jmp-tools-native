export const PROFILE_AVATARS = [
  { id: 'avatar_1', source: require('../assets/avatars/avatar_1.png') },
  { id: 'avatar_2', source: require('../assets/avatars/avatar_2.png') },
  { id: 'avatar_3', source: require('../assets/avatars/avatar_3.png') },
  { id: 'avatar_4', source: require('../assets/avatars/avatar_4.png') },
];

export const getProfileAvatarSource = (avatarId) =>
  PROFILE_AVATARS.find((avatar) => avatar.id === avatarId)?.source;

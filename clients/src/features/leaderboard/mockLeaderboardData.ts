import { PlayFormat, type RankingEntry } from '../../gen/sudoku/multi/v1/multi_pb'

export interface LeaderboardPlayerItem {
  rank: number
  userId: string
  playerName: string
  rating: number
  playFormat: PlayFormat
  matchesPlayed: number
  matchesWon: number
  matchesDrawn: number
  winRate: number
  isCurrentUser?: boolean
  avatarUrl?: string
}

/**
 * Xử lý danh sách người chơi xếp hạng từ máy chủ
 * Hoàn toàn dùng dữ liệu thực từ database/backend, không có dữ liệu giả
 */
export function processRankings(
  serverRankings: RankingEntry[],
  currentUserId?: string,
  currentUserName?: string,
  currentUserAvatar?: string,
  currentElo = 1000,
  matchesPlayed = 0,
  matchesWon = 0,
  playFormat = PlayFormat.RACE,
): { list: LeaderboardPlayerItem[]; callerItem?: LeaderboardPlayerItem } {
  const baseList: LeaderboardPlayerItem[] = []

  // Chỉ lấy dữ liệu người chơi thật từ máy chủ
  for (const item of serverRankings) {
    const isMe = Boolean(currentUserId && item.userId === currentUserId)
    const rating = isMe && currentElo > 0 ? Math.max(item.rating, currentElo) : item.rating
    const played = isMe && matchesPlayed > 0 ? Math.max(item.matchesPlayed, matchesPlayed) : item.matchesPlayed
    const won = isMe && matchesWon > 0 ? Math.max(item.matchesWon, matchesWon) : item.matchesWon
    const name = isMe && currentUserName ? currentUserName : item.playerName || item.userId

    baseList.push({
      rank: 0,
      userId: item.userId,
      playerName: name,
      rating,
      playFormat,
      matchesPlayed: played,
      matchesWon: won,
      matchesDrawn: item.matchesDrawn,
      winRate: played > 0 ? Math.round((won / played) * 100) : 0,
      isCurrentUser: isMe,
      avatarUrl: isMe ? currentUserAvatar : undefined,
    })
  }

  // Nếu người dùng hiện tại đã từng tham gia đấu trận (matchesPlayed > 0) và chưa có trong serverRankings
  if (currentUserId && matchesPlayed > 0 && !baseList.some((p) => p.userId === currentUserId)) {
    baseList.push({
      rank: 0,
      userId: currentUserId,
      playerName: currentUserName || 'Bạn',
      rating: currentElo,
      playFormat,
      matchesPlayed,
      matchesWon,
      matchesDrawn: 0,
      winRate: Math.round((matchesWon / matchesPlayed) * 100),
      isCurrentUser: true,
      avatarUrl: currentUserAvatar,
    })
  }

  // Sắp xếp giảm dần theo điểm Elo thực tế
  baseList.sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon
    return b.matchesPlayed - a.matchesPlayed
  })

  // Gán thứ hạng 1..N
  let callerItem: LeaderboardPlayerItem | undefined
  baseList.forEach((item, index) => {
    item.rank = index + 1
    if (item.isCurrentUser) {
      callerItem = item
    }
  })

  return { list: baseList, callerItem }
}

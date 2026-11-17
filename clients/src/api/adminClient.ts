import { createClient } from '@connectrpc/connect'
import { UserService } from '../gen/sudoku/user/v1/user_pb'
import { GameService } from '../gen/sudoku/game/v1/game_pb'
import { transport } from './transport'

export const adminUserClient = createClient(UserService, transport)
export const adminGameClient = createClient(GameService, transport)

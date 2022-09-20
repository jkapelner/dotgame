import {App} from 'app';
import {
  checkIntersection,
  colinearPointWithinSegment
} from 'line-intersect';

interface Point {
  x: number;
  y: number;
}

interface Line {
  start: Point;
  end: Point;
}

interface StateUpdate {
  newLine: Line | null;
  heading: string | null;
  message: string | null;
}

interface Payload {
  msg: string;
  body: StateUpdate | Point | string;
}

enum NodeStatus {
  ValidStartNode = "VALID_START_NODE",
  InvalidStartNode = "INVALID_START_NODE",
  ValidEndNode = "VALID_END_NODE",
  InvalidEndNode = "INVALID_END_NODE",
  GameOver = "GAME_OVER",
}

interface MoveResponse {
  status: NodeStatus;
  newLine: Line | null;
}

class GameServer {
  public app: App;
  private points: Point[] = [];
  private gridSize: Point;
  private start: Point | null = null;
  private moveTimer: number | null = null;
  private gameOver = false;

  constructor(app: App, gridSize: Point) {
    this.app = app;
    this.gridSize = gridSize;
    this.resetGame(true);
  }

  public resetGame(notifyClient: boolean) {
    this.start = null;
    this.points = [];
    this.gameOver = false;
    this.resetMoveTimer();

    if (notifyClient) {
      this.app.ports.response.send({
        msg: "INITIALIZE",
        body: {
          newLine: null,
          heading: 'Player 1',
          message: "Awaiting Player 1's Move"
        }
      })
    }
  }

  get player() {
    return (!this.points.length || this.points.length % 2) ? 1 : 2;
  }

  public getHeading(status: NodeStatus) {
    return (status === NodeStatus.GameOver) ? 'Game Over' : `Player ${this.player}`;
  }

  public getMessage(status: NodeStatus) {
    let message = null;

    switch (status) {
      case NodeStatus.ValidStartNode:
        message = "Select a second node to complete the line.";
        break;

      case NodeStatus.ValidEndNode:
        message = `Awaiting Player ${this.player}'s Move`;
        break;

      case NodeStatus.InvalidStartNode:
        message = "Not a valid starting position.";
        break;

      case NodeStatus.InvalidEndNode:
        message = "Invalid move!";
        break;

      case NodeStatus.GameOver:
        message = `Player ${this.player} wins!`;
        break;

      default:
        message = null;
        break;
    }

    return message;
  }

  private getIntersectType(line1: Line, line2: Line) {
    const intersection = checkIntersection(
      line1.start.x,
      line1.start.y,
      line1.end.x,
      line1.end.y,
      line2.start.x,
      line2.start.y,
      line2.end.x,
      line2.end.y
    );

    return intersection.type;
  }

  private areLinesColinear(line1: Line, line2: Line) {
    return this.getIntersectType(line1, line2) === 'colinear';
  }

  private linesIntersect(line1: Line, line2: Line) {
    const type = this.getIntersectType(line1, line2);

    if (type === 'intersecting') {
      return true;
    }

    if (type === 'colinear') {
      if (colinearPointWithinSegment(line1.start.x, line1.start.y,
        line2.start.x, line2.start.y, line2.end.x, line2.end.y)
      ) {
        return true;
      }

      if (colinearPointWithinSegment(line1.end.x, line1.end.y,
        line2.start.x, line2.start.y, line2.end.x, line2.end.y)
      ) {
        return true;
      }

      if (colinearPointWithinSegment(line2.start.x, line2.start.y,
        line1.start.x, line1.start.y, line1.end.x, line1.end.y)
      ) {
        return true;
      }

      if (colinearPointWithinSegment(line2.end.x, line2.end.y,
        line1.start.x, line1.start.y, line1.end.x, line1.end.y)
      ) {
        return true;
      }
    }

    return false;
  }

  private arePointsEqual(point1: Point, point2: Point) {
    return (point1.x === point2.x && point1.y === point2.y)
  }

  private pointIsValid(point: Point, isStartOfNewLine: boolean) {
    if (isStartOfNewLine && this.points.length) {
      // check that point starts at beginning or end
      const startPoint = this.points[0];
      const endPoint = this.points[this.points.length - 1];
      console.log(point);
      console.log(this.points);
      if (!this.arePointsEqual(point, startPoint) && !this.arePointsEqual(point, endPoint)) {
        return false;
      }
    }

    // check that point is within the grid
    return (point.x >= 0) && (point.x < this.gridSize.x) && (point.y >= 0) && (point.y < this.gridSize.y)
  }

  private lineIsValid(line: Line) {
    const sizeX = Math.abs(line.end.x - line.start.x);
    const sizeY = Math.abs(line.end.y - line.start.y);

    if (sizeX === 0 && sizeY === 0) {
      return false; // line must have a length
    }

    if ((sizeX > 0) && (sizeY > 0) && (sizeX !== sizeY)) {
      return false; // line must be horizontal, vertical, or diagonal
    }

    for (let i = 1; i < this.points.length; i++) {
      const otherLine = {start: this.points[i - 1], end: this.points[i]}

      if ((i === 1) && this.arePointsEqual(line.start, otherLine.start)) {
        if (this.areLinesColinear(line, otherLine)) {
          if (colinearPointWithinSegment(line.end.x, line.end.y,
            otherLine.start.x, otherLine.start.y, otherLine.end.x, otherLine.end.y)
          ) {
            return false;
          }
          if (colinearPointWithinSegment(otherLine.end.x, otherLine.end.y,
            line.start.x, line.start.y, line.end.x, line.end.y)
          ) {
            return false;
          }
        }
      }
      else if ((i === this.points.length - 1) && this.arePointsEqual(line.start, otherLine.end)) {
        if (this.areLinesColinear(line, otherLine)) {
          if (colinearPointWithinSegment(line.end.x, line.end.y,
            otherLine.start.x, otherLine.start.y, otherLine.end.x, otherLine.end.y)
          ) {
            return false;
          }
          if (colinearPointWithinSegment(otherLine.start.x, otherLine.start.y,
            line.start.x, line.start.y, line.end.x, line.end.y)
          ) {
            return false;
          }
        }
      }
      else if (this.linesIntersect(line, otherLine)) {
        return false; // line must not intersect with any other line
      }
    }

    return true;
  }

  private isFinalMove(point: Point) {
    for (let x = point.x - 1; x <= point.x + 1; x++) {
      for (let y = point.y - 1; y <= point.y + 1; y++) {
        const testPoint = {x: x, y: y};

        if (!this.arePointsEqual(point, testPoint)) {
          if (this.pointIsValid(testPoint, false)) {
            const testLine = {start: point, end: testPoint};

            if (this.lineIsValid(testLine)) {
              return false; // other move is possible, so not a final move
            }
          }
        }
      }
    }

    this.stopMoveTimer();
    this.gameOver = true;

    return true; // no other move is possible
  }

  private stopMoveTimer() {
    if (this.moveTimer) {
      clearTimeout(this.moveTimer);
      this.moveTimer = null;
    }
  }

  private startMoveTimer() {
    this.moveTimer = setTimeout(() => {
      this.app.ports.response.send({
        msg: "UPDATE_TEXT",
        body: {
          newLine: null,
          heading: `Player ${this.player}`,
          message: "Are you asleep?"
        }
      })
    }, 10000)
  }

  private resetMoveTimer() {
    this.stopMoveTimer();
    this.startMoveTimer();
  }

  public addMove(point: Point): MoveResponse {
    const response: MoveResponse = {
      status: NodeStatus.InvalidStartNode,
      newLine: null
    };

    if (this.gameOver) {
      response.status = NodeStatus.GameOver;
      return response;
    }

    if (this.start) {
      // end node
      if (this.pointIsValid(point, false)) {
        const line = {start: this.start, end: point};

        if (this.lineIsValid(line)) {
          response.status = NodeStatus.ValidEndNode;
          response.newLine = line;

          if (this.points.length) {
            // new move (not the 1st)
            if (this.arePointsEqual(this.start, this.points[0])) {
              this.points.unshift(point); // line started from beginning, so push new point to beginning
            } else {
              this.points.push(point); // line started at end, so push new point to end
            }

            // check if this is our last move
            if (this.isFinalMove(point)) {
              response.status = NodeStatus.GameOver;
            }
          } else {
            // 1st move - just push the start and end point
            this.points.push(this.start);
            this.points.push(point);
          }
        } else {
          response.status = NodeStatus.InvalidEndNode;
        }
      } else {
        response.status = NodeStatus.InvalidEndNode;
      }

      this.start = null; // clear the start node
    } else {
      // start node
      if (this.pointIsValid(point, true)) {
        this.start = point;
        response.status = NodeStatus.ValidStartNode;
      }
    }

    this.resetMoveTimer();

    return response;
  }
}

let gameServer: GameServer | null = null;

function receiveMessage(message: string) {
  const payload: Payload = JSON.parse(message);

  if (gameServer) {
    switch (payload.msg) {
      case 'INITIALIZE':
        gameServer.resetGame(false);
        break;

      case 'NODE_CLICKED':
        const response = gameServer.addMove(payload.body as Point);
        gameServer.app.ports.response.send({
          msg: response.status,
          body: {
            newLine: response.newLine,
            heading: gameServer.getHeading(response.status),
            message: gameServer.getMessage(response.status)
          }
        });
        break;

      case 'ERROR':
        // add some error logging on the server
        console.log(payload.body);
        break;
    }
  }
}

export function createGameServer(app: App, gridSize: Point) {
  // singleton
  if (!gameServer) {
    gameServer = new GameServer(app, gridSize);
    app.ports.request.subscribe(receiveMessage);
  }

  return gameServer;
}

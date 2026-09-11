import { Server } from 'socket.io';
import { verifySocketToken } from '../middleware/auth.js';
import { query } from '../db/index.js';

let io;
const projectRooms = new Map(); // projectId -> Set of socket ids

export const initializeWebSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*', // Allow all origins in development
      credentials: true
    },
    path: '/ws'
  });

  io.on('connection', async (socket) => {
    console.log('Client attempting connection:', socket.id);

    // Authenticate
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      console.log('No token provided, disconnecting:', socket.id);
      socket.disconnect();
      return;
    }

    const user = verifySocketToken(token);
    
    if (!user) {
      console.log('Invalid token, disconnecting:', socket.id);
      socket.disconnect();
      return;
    }

    socket.user = user;
    console.log(`User ${user.name} (${user.id}) connected:`, socket.id);

    // Handle project room joining
    socket.on('join_project', async (projectId) => {
      try {
        // Verify user has access to project
        const result = await query(
          'SELECT owner_id FROM projects WHERE id = $1',
          [projectId]
        );

        if (result.rows.length === 0) {
          socket.emit('error', { message: 'Project not found' });
          return;
        }

        const project = result.rows[0];
        const hasAccess = user.role === 'admin' || project.owner_id === user.id;

        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Join room
        const roomName = `project:${projectId}`;
        socket.join(roomName);

        // Track in our map
        if (!projectRooms.has(projectId)) {
          projectRooms.set(projectId, new Set());
        }
        projectRooms.get(projectId).add(socket.id);

        console.log(`User ${user.name} joined project ${projectId}`);
        socket.emit('joined_project', { projectId });

        // Notify others in the room
        socket.to(roomName).emit('user_joined', {
          userId: user.id,
          userName: user.name,
          projectId
        });
      } catch (error) {
        console.error('Join project error:', error);
        socket.emit('error', { message: 'Failed to join project' });
      }
    });

    // Handle leaving project
    socket.on('leave_project', (projectId) => {
      const roomName = `project:${projectId}`;
      socket.leave(roomName);

      if (projectRooms.has(projectId)) {
        projectRooms.get(projectId).delete(socket.id);
        if (projectRooms.get(projectId).size === 0) {
          projectRooms.delete(projectId);
        }
      }

      console.log(`User ${user.name} left project ${projectId}`);
      socket.to(roomName).emit('user_left', {
        userId: user.id,
        userName: user.name,
        projectId
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User ${user.name} disconnected:`, socket.id);

      // Clean up project rooms
      projectRooms.forEach((sockets, projectId) => {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            projectRooms.delete(projectId);
          }

          // Notify others
          const roomName = `project:${projectId}`;
          socket.to(roomName).emit('user_left', {
            userId: user.id,
            userName: user.name,
            projectId
          });
        }
      });
    });

    // Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  console.log('✓ WebSocket server initialized');
  return io;
};

// Emit events to all clients in a project room
export const emitToProject = (projectId, event, data) => {
  if (!io) {
    console.warn('WebSocket not initialized');
    return;
  }

  const roomName = `project:${projectId}`;
  io.to(roomName).emit(event, data);
  
  console.log(`Emitted ${event} to project ${projectId}:`, data);
};

// Get connected clients count for a project
export const getProjectClientCount = (projectId) => {
  return projectRooms.get(projectId)?.size || 0;
};

export default { initializeWebSocket, emitToProject, getProjectClientCount };

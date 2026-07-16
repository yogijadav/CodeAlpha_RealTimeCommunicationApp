import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// FIX: Force dotenv to step out of rtc-backend and read from the shared root directory
dotenv.config({ path: '../.env' });


const app = express();
const httpServer = createServer(app);

// Security Middleware
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());

// Initialize Supabase Admin Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Basic Health Check Route
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', time: new Date() });
});

// Configure Socket.io Server
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Socket.io Security Middleware: Validate user authentication before allowing connection
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error: Token missing'));
    }

    // Verify token directly with Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
        return next(new Error('Authentication error: Invalid session'));
    }

    // Attach validated user profile data to the socket stream 
    socket.user = user;
    next();
});

// Real-Time Event Routing
// Replace the old io.on('connection') block in server.js with this one:
io.on('connection', (socket) => {
    console.log(`User connected to signaling pipeline: ${socket.user.id}`);

    // Action: A user enters a room
    socket.on('join-room', ({ roomId }) => {
        socket.join(roomId);
        console.log(`User ${socket.user.id} (Socket: ${socket.id}) entered room: ${roomId}`);
        
        // Fix: Broadcast the specific SOCKET ID of the person who just joined
        socket.to(roomId).emit('user-joined', { 
            userId: socket.user.id,
            socketId: socket.id 
        });
    });

    // Fix: Route signals directly to the target peer socket instead of broadcasting blindly
    socket.on('signal', ({ roomId, targetSocketId, signalData }) => {
        if (targetSocketId) {
            // Direct targeted message to the specific peer
            io.to(targetSocketId).emit('signal-received', {
                senderId: socket.user.id,
                senderSocketId: socket.id,
                signalData: signalData
            });
        } else {
            // Fallback: Broadcast to the room if no specific target is given
            socket.to(roomId).emit('signal-received', {
                senderId: socket.user.id,
                senderSocketId: socket.id,
                signalData: signalData
            });
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected from socket: ${socket.id}`);
    });
});


// Boot up server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`Backend environment initialized successfully on port ${PORT}`);
});

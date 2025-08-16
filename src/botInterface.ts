import * as vscode from "vscode";

export class BotInterface {
  private panel: vscode.WebviewPanel | undefined;
  private currentEmotion: string = "focused";
  private sessionDuration: number = 0;
  private breakthroughCount: number = 0;
  private focusTime: number = 0;
  private currentReason: string = "Ready to code!";
  private waterReminderTimer: NodeJS.Timeout | undefined;
  private codeStats: {
    lineCount: number;
    errorCount: number;
    complexity: number;
    quality: string;
  } = {
    lineCount: 0,
    errorCount: 0,
    complexity: 0,
    quality: "good",
  };

  constructor() {
    console.log("BotInterface initialized");
  }

  public showBot(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    // Create and show panel
    this.panel = vscode.window.createWebviewPanel(
      "codingBuddyBot",
      "🤖 Coding Buddy Bot",
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    // Set the HTML content
    this.updateBotInterface();

    // Handle panel disposal
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    // Handle messages from webview
    if (this.panel && this.panel.webview) {
      this.panel.webview.onDidReceiveMessage((message: any) => {
        switch (message.command) {
          case "startSession":
            vscode.commands.executeCommand("coding-buddy-bot.startSession");
            break;
          case "stopSession":
            vscode.commands.executeCommand("coding-buddy-bot.stopSession");
            break;
        }
      });
    }
  }

  public updateBotInterface(): void {
    if (!this.panel) {
      return;
    }

    this.panel.webview.html = this.getWebviewContent();
  }

  public updateEmotion(emotion: string, reason?: string): void {
    console.log(
      `[BOT INTERFACE] updateEmotion called: ${emotion}, reason: ${reason}`
    );
    this.currentEmotion = emotion;
    if (reason) {
      this.currentReason = reason;
    }
    // Do not reveal or create the panel on background updates to avoid stealing focus
    if (this.panel) {
      this.updateBotInterface();
    }
  }

  public updateCodeStats(stats: {
    lineCount: number;
    errorCount: number;
    complexity: number;
    quality: string;
  }): void {
    this.codeStats = stats;
    this.updateBotInterface();
  }

  public updateSessionStats(
    duration: number,
    breakthroughs: number,
    focus: number
  ): void {
    this.sessionDuration = duration;
    this.breakthroughCount = breakthroughs;
    this.focusTime = focus;
    this.updateBotInterface();
  }

  // Timer control methods
  public startTimer(): void {
    if (this.panel) {
      this.panel.webview.postMessage({ command: 'startTimer' });
    }
  }

  public stopTimer(): void {
    if (this.panel) {
      this.panel.webview.postMessage({ command: 'stopTimer' });
    }
  }

  // WATER REMINDER METHODS
  public startWaterReminder(): void {
    // Clear any existing timer
    this.stopWaterReminder();
    
    // Set up water reminder every 15 seconds (for testing - change to 15 * 60 * 1000 for 15 minutes)
    this.waterReminderTimer = setInterval(() => {
      this.showWaterNotification();
    }, 15 * 1000); // 15 seconds for testing
    
    console.log("💧 Water reminder started - notifications every 15 seconds");
  }

  public stopWaterReminder(): void {
    if (this.waterReminderTimer) {
      clearInterval(this.waterReminderTimer);
      this.waterReminderTimer = undefined;
      console.log("💧 Water reminder stopped");
    }
  }

  private showWaterNotification(): void {
    const waterMessages = [
      "💧 Time to hydrate! Take a sip of water and keep that brain working smoothly!",
      "🚰 Hydration checkpoint! Your body needs water to keep coding at peak performance!",
      "💦 Don't forget to drink water! Stay hydrated, stay focused!",
      "🥤 Water break reminder! Your coding buddy cares about your health!",
      "💧 Quick hydration reminder - your brain is 75% water, keep it topped up!"
    ];

    const randomMessage = waterMessages[Math.floor(Math.random() * waterMessages.length)];
    
    // Show VS Code notification
    vscode.window.showInformationMessage(randomMessage);
    
    // Also send message to webview if it exists
    if (this.panel) {
      this.panel.webview.postMessage({ 
        command: 'waterReminder', 
        message: randomMessage 
      });
    }
  }

  private getWebviewContent(): string {
    const minutes = Math.floor(this.sessionDuration / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const displayTime =
      hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;

    return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Coding Buddy Bot</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        margin: 0;
                        padding: 20px;
                        background: red !important;
                        color: white;
                        min-height: 100vh;
                    }
                    .bot-container {
                        text-align: center;
                        max-width: 600px;
                        margin: 0 auto;
                    }
                    .bot-avatar {
                        font-size: 120px;
                        margin: 20px 0;
                        animation: bounce 2s infinite;
                    }
                    .bot-status {
                        background: rgba(255, 255, 255, 0.1);
                        padding: 20px;
                        border-radius: 15px;
                        margin: 20px 0;
                        backdrop-filter: blur(10px);
                    }
                    .emotion-display {
                        font-size: 24px;
                        margin: 15px 0;
                        padding: 10px;
                        background: rgba(255, 255, 255, 0.2);
                        border-radius: 10px;
                    }
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                        gap: 15px;
                        margin: 20px 0;
                    }
                    .stat-card {
                        background: rgba(255, 255, 255, 0.15);
                        padding: 15px;
                        border-radius: 10px;
                        text-align: center;
                    }
                    .stat-value {
                        font-size: 28px;
                        font-weight: bold;
                        margin: 5px 0;
                    }
                    .stat-label {
                        font-size: 14px;
                        opacity: 0.8;
                    }
                    .controls {
                        margin: 20px 0;
                    }
                    .btn {
                        background: rgba(255, 255, 255, 0.2);
                        border: none;
                        color: white;
                        padding: 12px 24px;
                        margin: 5px;
                        border-radius: 25px;
                        cursor: pointer;
                        font-size: 16px;
                        transition: all 0.3s ease;
                    }
                    .btn:hover {
                        background: rgba(255, 255, 255, 0.3);
                        transform: translateY(-2px);
                    }
                    .btn:active {
                        transform: translateY(0);
                    }
                    .btn:disabled {
                        background: rgba(255, 255, 255, 0.1);
                        cursor: not-allowed;
                        opacity: 0.6;
                    }
                    .btn:disabled:hover {
                        background: rgba(255, 255, 255, 0.1);
                        transform: none;
                    }
                    .message-log {
                        background: rgba(0, 0, 0, 0.2);
                        padding: 15px;
                        border-radius: 10px;
                        margin: 20px 0;
                        max-height: 200px;
                        overflow-y: auto;
                        text-align: left;
                    }
                    .message {
                        margin: 5px 0;
                        padding: 8px;
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 8px;
                        font-size: 14px;
                    }
                    .water-message {
                        background: rgba(0, 150, 255, 0.3);
                        border-left: 4px solid #0096ff;
                    }
                    .reason-display {
                        font-size: 18px;
                        margin: 10px 0;
                        padding: 12px;
                        background: rgba(255, 255, 255, 0.15);
                        border-radius: 10px;
                        font-style: italic;
                    }
                    .code-analysis {
                        background: rgba(255, 255, 255, 0.1);
                        padding: 20px;
                        border-radius: 15px;
                        margin: 20px 0;
                    }
                    .code-stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                        gap: 15px;
                        margin: 15px 0;
                    }
                    .code-stat-card {
                        background: rgba(255, 255, 255, 0.15);
                        padding: 12px;
                        border-radius: 10px;
                        text-align: center;
                    }
                    .code-stat-value {
                        font-size: 24px;
                        font-weight: bold;
                        margin: 5px 0;
                    }
                    .code-stat-label {
                        font-size: 12px;
                        opacity: 0.8;
                    }
                    @keyframes bounce {
                        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                        40% { transform: translateY(-10px); }
                        60% { transform: translateY(-5px); }
                    }
                    .pulse {
                        animation: pulse 2s infinite;
                    }
                    @keyframes pulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.05); }
                        100% { transform: scale(1); }
                    }
                </style>
            </head>
            <body>
                <div class="bot-container">
                    <div class="bot-avatar pulse">
                        ${this.getBotEmoji()}
                    </div>
                    
                    <h1>🤖 Coding Buddy Bot</h1>
                    
                    <div class="bot-status">
                        <h2>Current Status</h2>
                        <div class="emotion-display">
                            🎭 Feeling: <strong>${this.currentEmotion}</strong>
                        </div>
                        <div class="reason-display">
                            💭 ${this.currentReason}
                        </div>
                    </div>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value">⏱️</div>
                            <div class="stat-value" id="session-timer">${displayTime}</div>
                            <div class="stat-label">Session Time</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">🚀</div>
                            <div class="stat-value">${
                              this.breakthroughCount
                            }</div>
                            <div class="stat-label">Breakthroughs</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">🎯</div>
                            <div class="stat-value">${Math.floor(
                              this.focusTime / (1000 * 60)
                            )}m</div>
                            <div class="stat-label">Focus Time</div>
                        </div>
                    </div>
                    
                    <div class="code-analysis">
                        <h3>📊 Code Analysis</h3>
                        <div class="code-stats-grid">
                            <div class="code-stat-card">
                                <div class="code-stat-value">📝</div>
                                <div class="code-stat-value">${
                                  this.codeStats.lineCount
                                }</div>
                                <div class="code-stat-label">Lines of Code</div>
                            </div>
                            <div class="code-stat-card">
                                <div class="code-stat-value">❌</div>
                                <div class="code-stat-value">${
                                  this.codeStats.errorCount
                                }</div>
                                <div class="code-stat-label">Errors</div>
                            </div>
                            <div class="code-stat-card">
                                <div class="code-stat-value">🧠</div>
                                <div class="code-stat-value">${
                                  this.codeStats.complexity
                                }</div>
                                <div class="code-stat-label">Complexity</div>
                            </div>
                            <div class="code-stat-card">
                                <div class="code-stat-value">⭐</div>
                                <div class="code-stat-value">${
                                  this.codeStats.quality
                                }</div>
                                <div class="code-stat-label">Quality</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="controls">
                        <button class="btn" onclick="startSession()" id="start-btn">🚀 Start Session</button>
                        <button class="btn" onclick="stopSession()" id="stop-btn">⏹️ Stop Session</button>
                    </div>
                    
                    <div class="message-log" id="message-log">
                        <h3>💬 Recent Messages</h3>
                        <div class="message">🎯 Welcome to your coding session!</div>
                        <div class="message">💪 I'm here to cheer you on and keep you healthy!</div>
                        <div class="message">🌟 Remember: Every great developer started somewhere!</div>
                    </div>
                </div>
                
                <script>
                    const vscodeApi = acquireVsCodeApi();
                    let timerInterval = null;
                    let sessionStartTime = null;
                    let isTimerRunning = false;
                    
                    function startSession() {
                        vscodeApi.postMessage({ command: 'startSession' });
                    }
                    
                    function stopSession() {
                        vscodeApi.postMessage({ command: 'stopSession' });
                    }
                    
                    function updateTimerDisplay() {
                        if (!sessionStartTime || !isTimerRunning) return;
                        
                        const now = Date.now();
                        const elapsed = now - sessionStartTime;
                        const totalSeconds = Math.floor(elapsed / 1000);
                        
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                        const seconds = totalSeconds % 60;
                        
                        let timeString;
                        if (hours > 0) {
                            timeString = hours + 'h ' + minutes + 'm ' + seconds + 's';
                        } else {
                            timeString = minutes + 'm ' + seconds + 's';
                        }
                        
                        const timerElement = document.getElementById('session-timer');
                        if (timerElement) {
                            timerElement.textContent = timeString;
                        }
                    }
                    
                    function startTimer() {
                        sessionStartTime = Date.now();
                        isTimerRunning = true;
                        
                        // Update immediately
                        updateTimerDisplay();
                        
                        // Start interval to update every second
                        if (timerInterval) {
                            clearInterval(timerInterval);
                        }
                        timerInterval = setInterval(updateTimerDisplay, 1000);
                        
                        // Update button states
                        const startBtn = document.getElementById('start-btn');
                        const stopBtn = document.getElementById('stop-btn');
                        if (startBtn) startBtn.disabled = true;
                        if (stopBtn) stopBtn.disabled = false;
                    }
                    
                    function stopTimer() {
                        isTimerRunning = false;
                        
                        if (timerInterval) {
                            clearInterval(timerInterval);
                            timerInterval = null;
                        }
                        
                        // Update button states
                        const startBtn = document.getElementById('start-btn');
                        const stopBtn = document.getElementById('stop-btn');
                        if (startBtn) startBtn.disabled = false;
                        if (stopBtn) stopBtn.disabled = true;
                    }
                    
                    function addWaterMessage(message) {
                        const messageLog = document.getElementById('message-log');
                        if (messageLog) {
                            const newMessage = document.createElement('div');
                            newMessage.className = 'message water-message';
                            newMessage.textContent = message;
                            
                            // Add after the header but before other messages
                            const messages = messageLog.querySelectorAll('.message');
                            if (messages.length > 0) {
                                messageLog.insertBefore(newMessage, messages);
                            } else {
                                messageLog.appendChild(newMessage);
                            }
                            
                            // Keep only the last 10 messages
                            const allMessages = messageLog.querySelectorAll('.message');
                            if (allMessages.length > 10) {
                                allMessages[allMessages.length - 1].remove();
                            }
                        }
                    }
                    
                    // Listen for messages from the extension
                    window.addEventListener('message', function(event) {
                        const message = event.data;
                        switch (message.command) {
                            case 'startTimer':
                                startTimer();
                                break;
                            case 'stopTimer':
                                stopTimer();
                                break;
                            case 'waterReminder':
                                addWaterMessage(message.message);
                                break;
                        }
                    });
                    
                    // Initialize button states
                    document.addEventListener('DOMContentLoaded', function() {
                        const startBtn = document.getElementById('start-btn');
                        const stopBtn = document.getElementById('stop-btn');
                        if (startBtn) startBtn.disabled = false;
                        if (stopBtn) stopBtn.disabled = true;
                    });
                </script>
            </body>
            </html>
        `;
  }

  private getBotEmoji(): string {
    const emojiMap: { [key: string]: string } = {
      happy: "😊",
      frustrated: "😤",
      concerned: "😟",
    };
    return emojiMap[this.currentEmotion] || "😊";
  }

  public dispose(): void {
    // Stop water reminder when disposing
    this.stopWaterReminder();
    
    if (this.panel) {
      this.panel.dispose();
    }
  }
}
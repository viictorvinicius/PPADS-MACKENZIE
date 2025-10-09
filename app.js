const STORAGE_USERS_KEY = 'todo_users_v1';
const STORAGE_TASKS_PREFIX = 'todo_tasks_';
const STORAGE_CURRENT_USER_KEY = 'todo_current_user';

let currentUser = null;
let currentEditTaskId = null;

const DOM = {
    authSection: document.getElementById('auth'),
    appSection: document.getElementById('app'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    btnLogout: document.getElementById('btn-logout'),
    userGreeting: document.getElementById('user-greeting'),
    pendingList: document.getElementById('pending-list'),
    completedList: document.getElementById('completed-list'),
    btnNewTask: document.getElementById('btn-new-task'),
    taskModal: document.getElementById('task-modal'),
    taskForm: document.getElementById('task-form'),
    modalTitle: document.getElementById('modal-title'),
    modalBackButton: document.getElementById('modal-back'),
    taskCancelButton: document.getElementById('task-cancel'),
    saveTaskButton: document.getElementById('save-task'),
    taskTitleInput: document.getElementById('task-title'),
    taskDescInput: document.getElementById('task-desc'),
    taskPriorityInput: document.getElementById('task-priority'),
    tabPending: document.getElementById('tab-pending'),
    tabCompleted: document.getElementById('tab-completed'),
    countPending: document.getElementById('count-pending'),
    countCompleted: document.getElementById('count-completed'),
    listTitle: document.getElementById('list-title'),
    emptyPlaceholder: document.getElementById('empty-placeholder'),
    emptyIcon: document.querySelector('#empty-placeholder .empty-ico'),
    emptyText: document.querySelector('#empty-placeholder .empty-text'),
    toast: document.getElementById('toast'),
};

async function sha256(string) {
    const utf8 = new TextEncoder().encode(string);
    const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function showToast(message) {
    DOM.toast.textContent = message;
    DOM.toast.classList.remove('hidden');
    setTimeout(() => DOM.toast.classList.add('hidden'), 2200);
}

function loadUsers() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_USERS_KEY) || '{}');
    } catch {
        showToast('Erro ao carregar usuários.');
        return {};
    }
}

function saveUsers(users) {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
}

function getTasksKey(email) {
    return `${STORAGE_TASKS_PREFIX}${email}`;
}

function loadTasks(email) {
    try {
        return JSON.parse(localStorage.getItem(getTasksKey(email)) || '[]');
    } catch {
        showToast('Erro ao carregar tarefas.');
        return [];
    }
}

function saveTasks(email, tasks) {
    localStorage.setItem(getTasksKey(email), JSON.stringify(tasks));
}

async function handleRegister(event) {
    event.preventDefault();
    const name = DOM.registerForm.querySelector('#reg-name').value.trim();
    const email = DOM.registerForm.querySelector('#reg-email').value.trim().toLowerCase();
    const password = DOM.registerForm.querySelector('#reg-password').value;

    if (!name || !email || !password) {
        showToast('Preencha todos os campos obrigatórios.');
        return;
    }

    const users = loadUsers();
    if (users[email]) {
        showToast('Este e-mail já está em uso.');
        return;
    }

    const passwordHash = await sha256(password);
    users[email] = { name, email, passwordHash };
    saveUsers(users);
    showToast('Conta criada com sucesso!');
    DOM.registerForm.reset();
}

async function handleLogin(event) {
    event.preventDefault();
    const email = DOM.loginForm.querySelector('#login-email').value.trim().toLowerCase();
    const password = DOM.loginForm.querySelector('#login-password').value;
    const users = loadUsers();
    const user = users[email];

    if (!user) {
        showToast('Usuário não encontrado.');
        return;
    }

    const passwordHash = await sha256(password);
    if (passwordHash !== user.passwordHash) {
        showToast('Senha inválida.');
        return;
    }

    currentUser = user;
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, currentUser.email);
    showToast(`Bem-vindo, ${currentUser.name}!`);
    DOM.loginForm.reset();
    initializeApp();
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
    DOM.authSection.classList.remove('hidden');
    DOM.appSection.classList.add('hidden');
    DOM.userGreeting.classList.add('hidden');
    DOM.btnLogout.classList.add('hidden');
}

function initializeApp() {
    DOM.authSection.classList.add('hidden');
    DOM.appSection.classList.remove('hidden');
    DOM.userGreeting.textContent = `Olá, ${currentUser.name}!`;
    DOM.userGreeting.classList.remove('hidden');
    DOM.btnLogout.classList.remove('hidden');
    setActiveTab('pending');
}

function setActiveTab(tabName) {
    const isPending = tabName === 'pending';

    DOM.tabPending.classList.toggle('active', isPending);
    DOM.tabCompleted.classList.toggle('active', !isPending);

    DOM.pendingList.classList.toggle('hidden', !isPending);
    DOM.completedList.classList.toggle('hidden', isPending);

    DOM.listTitle.textContent = isPending ? 'Tarefas Pendentes' : 'Tarefas Concluídas';

    renderTasks();
}

function createTaskElement(task) {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.dataset.taskId = task.id;

    const isCompleted = task.status === 'done';

    const priorityClass = task.priority.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const formattedDate = new Date(isCompleted ? task.completedAt : task.createdAt).toLocaleDateString();

    li.innerHTML = `
        <div class="task-meta">
            <div class="title" style="text-decoration: ${isCompleted ? 'line-through' : 'none'}">${task.title}</div>
            <div class="desc">${task.description || ''}</div>
            <div class="meta-row">
                <span class="priority ${priorityClass}">${task.priority}</span>
                <span>${formattedDate}</span>
            </div>
        </div>
        <div class="task-actions">
            ${isCompleted ? `
                <button class="icon-btn reopen-btn" title="Reabrir Tarefa">↺</button>
            ` : `
                <button class="icon-btn edit-btn" title="Editar Tarefa">✎</button>
                <button class="icon-btn done-btn" title="Concluir Tarefa">✔</button>
            `}
            <button class="icon-btn delete-btn" title="Remover Tarefa">🗑</button>
        </div>
    `;

    li.querySelector('.delete-btn').addEventListener('click', () => {
        if (confirm('Tem certeza que deseja remover esta tarefa?')) {
            deleteTask(task.id);
        }
    });

    if (isCompleted) {
        li.querySelector('.reopen-btn').addEventListener('click', () => toggleTaskStatus(task.id));
    } else {
        li.querySelector('.edit-btn').addEventListener('click', () => openTaskModal(task.id));
        li.querySelector('.done-btn').addEventListener('click', () => toggleTaskStatus(task.id));
    }

    return li;
}

function renderTasks() {
    if (!currentUser) return;

    const tasks = loadTasks(currentUser.email);
    const pendingTasks = tasks.filter(t => t.status !== 'done').sort((a, b) => b.createdAt - a.createdAt);
    const completedTasks = tasks.filter(t => t.status === 'done').sort((a, b) => b.completedAt - a.completedAt);

    DOM.countPending.textContent = pendingTasks.length;
    DOM.countCompleted.textContent = completedTasks.length;

    DOM.pendingList.innerHTML = '';
    DOM.completedList.innerHTML = '';

    pendingTasks.forEach(task => DOM.pendingList.appendChild(createTaskElement(task)));
    completedTasks.forEach(task => DOM.completedList.appendChild(createTaskElement(task)));

    const isPendingActive = DOM.tabPending.classList.contains('active');
    const isListEmpty = (isPendingActive && pendingTasks.length === 0) || (!isPendingActive && completedTasks.length === 0);

    if (isListEmpty) {
        if (isPendingActive) {
            DOM.emptyIcon.textContent = '⏱️';
            DOM.emptyText.textContent = 'Nenhuma tarefa pendente! Que tal criar uma nova tarefa?';
        } else {
            DOM.emptyIcon.textContent = '✅';
            DOM.emptyText.textContent = 'Nenhuma tarefa concluída ainda. Complete algumas tarefas para vê-las aqui!';
        }
    }

    DOM.emptyPlaceholder.classList.toggle('hidden', !isListEmpty);
}

function openTaskModal(taskId = null) {
    DOM.taskForm.reset();
    currentEditTaskId = taskId;

    if (taskId) {
        const tasks = loadTasks(currentUser.email);
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        DOM.modalTitle.textContent = 'Editar Tarefa';
        DOM.saveTaskButton.textContent = 'Salvar Alterações';
        DOM.taskTitleInput.value = task.title;
        DOM.taskDescInput.value = task.description || '';
        DOM.taskPriorityInput.value = task.priority || 'Média';
    } else {
        DOM.modalTitle.textContent = 'Nova Tarefa';
        DOM.saveTaskButton.textContent = 'Criar Tarefa';
        DOM.taskPriorityInput.value = 'Média';
    }

    DOM.taskModal.setAttribute('aria-hidden', 'false');
    DOM.taskTitleInput.focus();
}

function closeTaskModal() {
    DOM.taskModal.setAttribute('aria-hidden', 'true');
    currentEditTaskId = null;
}

function handleTaskFormSubmit(event) {
    event.preventDefault();
    const title = DOM.taskTitleInput.value.trim();
    if (!title) {
        showToast('O título da tarefa é obrigatório.');
        return;
    }

    const description = DOM.taskDescInput.value.trim();
    const priority = DOM.taskPriorityInput.value;

    const tasks = loadTasks(currentUser.email);

    if (currentEditTaskId) {
        const taskIndex = tasks.findIndex(t => t.id === currentEditTaskId);
        if (taskIndex > -1) {
            tasks[taskIndex] = { ...tasks[taskIndex], title, description, priority };
            showToast('Tarefa atualizada com sucesso!');
        }
    } else {
        const newTask = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2),
            title,
            description,
            priority,
            status: 'pending',
            createdAt: Date.now(),
            completedAt: null,
        };
        tasks.push(newTask);
        showToast('Tarefa criada com sucesso!');
    }

    saveTasks(currentUser.email, tasks);
    renderTasks();
    closeTaskModal();
}

function deleteTask(taskId) {
    let tasks = loadTasks(currentUser.email);
    tasks = tasks.filter(t => t.id !== taskId);
    saveTasks(currentUser.email, tasks);
    renderTasks();
    showToast('Tarefa removida.');
}

function toggleTaskStatus(taskId) {
    const tasks = loadTasks(currentUser.email);
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.status === 'done') {
        task.status = 'pending';
        task.completedAt = null;
        showToast('Tarefa reaberta.');
    } else {
        task.status = 'done';
        task.completedAt = Date.now();
        showToast('Tarefa concluída!');
    }

    saveTasks(currentUser.email, tasks);
    renderTasks();
}

DOM.registerForm.addEventListener('submit', handleRegister);
DOM.loginForm.addEventListener('submit', handleLogin);
DOM.btnLogout.addEventListener('click', handleLogout);
DOM.btnNewTask.addEventListener('click', () => openTaskModal());
DOM.taskForm.addEventListener('submit', handleTaskFormSubmit);
DOM.taskCancelButton.addEventListener('click', closeTaskModal);
DOM.modalBackButton.addEventListener('click', closeTaskModal);
DOM.tabPending.addEventListener('click', () => setActiveTab('pending'));
DOM.tabCompleted.addEventListener('click', () => setActiveTab('completed'));

document.addEventListener('DOMContentLoaded', () => {
    const loggedUserEmail = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
    const users = loadUsers();

    if (loggedUserEmail && users[loggedUserEmail]) {
        currentUser = users[loggedUserEmail];
        initializeApp();
    } else {
        DOM.authSection.classList.remove('hidden');
        DOM.appSection.classList.add('hidden');
    }
});
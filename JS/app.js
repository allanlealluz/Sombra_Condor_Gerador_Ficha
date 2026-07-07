// Inicializador central do Motor RPG
document.addEventListener("DOMContentLoaded", () => {
    
    // Inicializa o sistema de Banco de Dados passando um callback executado ao terminar
    DBSystem.init(() => {
        
        // Remove a tela de carregamento do DOM
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        
        // Popula as barras laterais com os dados salvos/carregados
        refreshAll();
        
        console.log("Sombra do Condor Engine v4.0 inicializado com sucesso.");
    });
});
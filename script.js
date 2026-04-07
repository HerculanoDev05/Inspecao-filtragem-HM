 // Seleção visual dos radio buttons
        document.querySelectorAll('.radio-option input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', function() {
                // Remove seleção de todos os radios do mesmo grupo
                const name = this.name;
                document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
                    r.closest('.radio-option').classList.remove('selected');
                });
                
                // Adiciona seleção ao radio atual
                this.closest('.radio-option').classList.add('selected');

                // Gerencia campos condicionais
                if (this.hasAttribute('data-toggle')) {
                    const toggleId = this.getAttribute('data-toggle');
                    const conditionalField = document.getElementById(toggleId);
                    
                    if (this.value === 'Pendente' || this.value.includes('inadequada') || this.value.includes('inaceitável')) {
                        conditionalField.classList.add('show');
                    } else {
                        conditionalField.classList.remove('show');
                    }
                }
            });
        });

        // Função para mostrar nome do arquivo selecionado
        function showFileName(input, previewId) {
            const preview = document.getElementById(previewId);
            if (input.files && input.files[0]) {
                preview.textContent = `📎 Arquivo: ${input.files[0].name}`;
            } else {
                preview.textContent = '';
            }
        }

        // Submissão do formulário
        document.getElementById('inspectionForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Coleta todos os dados do formulário
            const formData = new FormData(this);
            const data = {};
            
            for (let [key, value] of formData.entries()) {
                data[key] = value;
            }
            
            console.log('Dados do formulário:', data);
            
            // Aqui você pode adicionar a lógica de envio
            // Por exemplo, enviar para um webhook ou API
            
            alert('Formulário enviado com sucesso!\n\nDados capturados no console.');
            
            // Exemplo de envio para webhook (descomente para usar)
            /*
            fetch('https://seu-webhook-url.com', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(data => {
                alert('Formulário enviado com sucesso!');
                this.reset();
            })
            .catch(error => {
                console.error('Erro:', error);
                alert('Erro ao enviar formulário.');
            });
            */
        });

        // LocalStorage - Salvar progresso automaticamente
        const form = document.getElementById('inspectionForm');
        const formFields = form.querySelectorAll('input, select, textarea');

        // Carregar dados salvos
        window.addEventListener('load', () => {
            formFields.forEach(field => {
                const savedValue = localStorage.getItem(`inspecao_${field.name}`);
                if (savedValue && field.type !== 'file') {
                    if (field.type === 'radio') {
                        if (field.value === savedValue) {
                            field.checked = true;
                            field.dispatchEvent(new Event('change'));
                        }
                    } else {
                        field.value = savedValue;
                    }
                }
            });
        });

        // Salvar dados automaticamente
        formFields.forEach(field => {
            field.addEventListener('change', () => {
                if (field.type !== 'file') {
                    localStorage.setItem(`inspecao_${field.name}`, field.value);
                }
            });
        });

        // Limpar localStorage após envio bem-sucedido
        form.addEventListener('submit', (e) => {
            // Descomentar após confirmar envio bem-sucedido
            // formFields.forEach(field => {
            //     localStorage.removeItem(`inspecao_${field.name}`);
            // });
        });
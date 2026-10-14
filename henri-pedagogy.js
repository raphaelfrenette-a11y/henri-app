/* Editable teaching starters, not quotations or ministerial allocation rules. */
(function(root){
  const drills={
    'Badminton':['Échanges coopératifs au-dessus du filet','Dégagement vers une zone profonde'],
    'Tennis':['Échanges contrôlés après un rebond','Viser des zones larges en coup droit'],
    'Pickleball':['Échanges courts dans la zone de non-volée','Alterner placement court et frappe profonde'],
    'Tennis de table':['Échanges réguliers en coup droit','Diriger la balle vers deux cibles'],
    'Basketball':['Passer et se déplacer dans un triangle','Jouer un deux contre un vers le panier'],
    'Ultimate':['Passes courtes et pivot en duo','Se démarquer dans un trois contre un'],
    'Flag football':['Passer et recevoir sur un tracé simple','Créer deux options de passe sans contact'],
    'Soccer':['Passes au sol et contrôle orienté','Conserver le ballon en trois contre un'],
    'Futsal':['Passes courtes et contrôle avec la semelle','Créer une ligne de passe en espace réduit'],
    'Handball':['Passe en mouvement et réception à deux mains','Créer un surnombre avant de tirer'],
    'Volleyball':['Manchette vers un partenaire cible','Construire un échange en trois touches adaptées'],
    'Dodgeball':['Lancer vers des cibles basses sans viser la tête','Se déplacer et protéger une zone avec son équipe'],
    'Kin-Ball':['Se placer autour du ballon et annoncer une équipe','Se coordonner pour recevoir et soutenir le ballon'],
    'Jeux de coopération':['Transporter un objet avec des contraintes partagées','Résoudre un parcours où chaque partenaire a un rôle'],
    'Judo':['Travail d’équilibre et déplacements sans projection','Opposition à genoux : conserver ou libérer une prise autorisée'],
    'Lutte':['Déplacements et maintien des appuis','Opposition au sol : sortir d’une zone sans geste brusque'],
    'Conditionnement physique':['Circuit : squat, marche rapide et gainage adaptés','Comparer son effort perçu et ajuster l’intensité'],
    'Musculation':['Apprendre un mouvement avec charge légère ou poids du corps','Adapter les répétitions en conservant une exécution contrôlée'],
    'Course / endurance':['Alterner course et marche à une allure confortable','Ajuster son allure avec le test de la parole'],
    'Course':['Courir à une allure régulière sur une courte distance','Adapter son rythme entre deux essais'],
    'Athlétisme':['Coordonner une course et une zone de réception','Comparer deux essais et ajuster son geste'],
    'Gymnastique':['Enchaîner des appuis et équilibres au sol','Construire un court enchaînement avec une réception contrôlée'],
    'Natation':['Déplacements courts dans une zone adaptée au niveau','Coordonner respiration et propulsion avec une aide autorisée'],
    'Patinage':['Se déplacer et freiner dans une zone balisée','Suivre un parcours avec changements de direction'],
    'Plein air':['Se repérer dans un parcours balisé','Choisir une allure et du matériel adaptés aux conditions']
  };
  const names=['Échauffement','Éducatif 1','Éducatif 2','Situation de partie'];
  function counts(total, level, fallback){
    if(level.type!=='secondary')return fallback;
    const C1=total>=5?1:0;
    const C3=total>=3?Math.min(total-C1-1,Math.max(1,Math.round(total*.15))):0;
    return {C1,C2:total-C1-C3,C3};
  }
  function distribution(total,count){
    if(!Number.isInteger(total)||total<1||!Number.isInteger(count)||count<1||count>total)throw new Error('Chaque séquence doit avoir au moins une période.');
    const base=Math.floor(total/count),extra=total%count;
    return Array.from({length:count},(_,i)=>base+(i<extra?1:0));
  }
  function session({sport,comp,index,count,duration,useHenri,level}){
    const minutes=Math.max(20,parseInt(duration,10)||70);
    const times=[Math.round(minutes*.1),Math.round(minutes*.2),Math.round(minutes*.25)];
    times.push(minutes-times.reduce((a,b)=>a+b,0));
    const blocks=names.map((type,i)=>({type,title:'',notes:'',minutes:times[i]}));
    if(!useHenri)return {title:'Séance '+(index+1)+' · '+sport,objective:'',blocks};
    const themes=['Découvrir et observer','Stabiliser les actions','Choisir et adapter','Réinvestir en opposition','Faire le bilan et ajuster'];
    const stage=Math.min(4,Math.floor(index*5/Math.max(1,count)));
    const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const recognized=Object.keys(drills).find(name=>normalize(name)===normalize(sport));
    const pair=drills[recognized]||['Explorer une action simple en lien avec '+sport,'Réinvestir cette action avec un partenaire et une contrainte adaptée'];
    const objective=comp==='C3'?'Observer son effort et ajuster une habitude de pratique.':comp==='C1'?'Exécuter une action contrôlée et ajuster son geste.':'Choisir une action et se coordonner avec un partenaire.';
    const adaptation=level?.type==='secondary'?(level.grade<=2?'Premier cycle du secondaire : consignes courtes, un choix à expliquer et opposition progressive.':'Deuxième cycle du secondaire : faire justifier un choix, observer son efficacité et ajuster la difficulté.'):level?.type==='primary'?(level.grade<=2?'Début du primaire : démonstration courte, distances réduites et matériel facile à manipuler.':'Primaire : proposer deux niveaux de défi et alterner les rôles avec une consigne simple.'):'Adapter les distances, le matériel et les consignes au niveau réel du groupe.';
    const progression=['Démontrer puis essayer sans opposition.','Répéter avec une cible et donner une rétroaction descriptive.','Ajouter une contrainte à la fois et comparer les choix.','Ajouter une opposition progressive, avec règles et rôles explicites.','Réinvestir, observer et nommer une amélioration pour la prochaine pratique.'][stage];
    blocks[0].title='Activation progressive · '+sport;
    blocks[0].notes='Déplacements légers, mobilisation des articulations et un essai simple du geste du jour. Vérifier l’espace, le matériel et les règles de sécurité. '+adaptation;
    blocks[1].title=pair[0];blocks[1].notes=progression+' Démontrer le geste, organiser de petits ateliers et observer un critère : contrôle, précision ou équilibre. '+adaptation;
    blocks[2].title=pair[1];blocks[2].notes=progression+' Alterner les rôles de pratiquant et d’observateur; chacun décrit un choix réussi et un ajustement.';
    blocks[3].title=comp==='C3'?'Circuit adapté et bilan de son effort':comp==='C1'?'Défi moteur et observation des progrès':'Partie adaptée · '+sport;
    blocks[3].notes=comp==='C3'?'Choisir deux ou trois ateliers, adapter l’intensité, prévoir récupération et hydratation. Noter l’effort perçu puis choisir un ajustement réaliste.':comp==='C1'?'Réinvestir les actions dans un parcours ou une courte prestation. Observer le contrôle du geste et comparer deux essais, sans imposer une difficulté identique à tous.':'Former de petites équipes ou des duos. Utiliser des règles adaptées au sport et au niveau; faire des pauses pour ajuster le placement et les décisions. Terminer par un court retour sur les choix de l’équipe.';
    return {title:'Séance '+(index+1)+' · '+themes[stage]+' · '+sport,objective,blocks};
  }
  const api={counts,distribution,session,sports:Object.keys(drills)};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.HenriPedagogy=api;
})(typeof window==='object'?window:globalThis);

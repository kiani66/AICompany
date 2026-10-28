export const roles = [
 {slug:'project-manager', name:'Project Manager', description:'Coordinates planning and reports to the CEO.', reportsTo:null, capabilities:['planning','coordination']},
 {slug:'software-architect', name:'Software Architect', description:'Defines architecture and technical direction.', reportsTo:'project-manager', capabilities:['architecture','design']},
 {slug:'backend-developer', name:'Backend Developer', description:'Develops server-side systems.', reportsTo:'software-architect', capabilities:['backend','data']},
 {slug:'frontend-developer', name:'Frontend Developer', description:'Develops accessible user interfaces.', reportsTo:'software-architect', capabilities:['frontend','accessibility']},
 {slug:'qa-engineer', name:'QA Engineer', description:'Plans and verifies quality.', reportsTo:'project-manager', capabilities:['testing','quality']},
 {slug:'code-reviewer-devops', name:'Code Reviewer & DevOps', description:'Reviews changes and delivery practices.', reportsTo:'project-manager', capabilities:['review','delivery']},
] as const;

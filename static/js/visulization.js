function Visualizer (){

    var that = this;
    this.data = {
        "name": "Root",
        "children": [],
        "black": [],
        "white": []
    };
    this.width = 600;
    this.height = 400;
    this.i = 0

    this.sourceCanvas = document.getElementById('sourceCanvas');
    this.ctx = this.sourceCanvas.getContext('2d');

    this.reset_data = function(){
        this.data = {
            "name": "Root",
            "children": [],
            "black": [],
            "white": []
        };
    }

    this.read_data = function (raw_data, black_pieces, white_pieces, color=0){
        this.i = 0;
        this.data = {
            "name": "Root",
            "children": [],
            "black": black_pieces,
            "white": white_pieces
        };
        var my_color = color === 0 ? "black" : "white"
        var op_color = color === 0 ? "white" : "black"
        for (let k in raw_data){
            if (raw_data[k] != "terminal"){continue;}
            var cur_d = this.data["children"]
            console.log(k)
            var d = 0
            var black_buf = []
            var white_buf = []
            for (let n of k.split(',')){
                console.log(n)
                var flag = false
                for (var cl of cur_d){
                    if (cl["name"].endsWith(n)){
                        cur_d = cl["children"]
                        flag = true;
                        break;
                    }
                }
                if (d % 2 === 0){
                    if (my_color === "black"){black_buf.push(Number(n))}
                    else{white_buf.push(Number(n))}
                }
                else{
                    if (my_color === "white"){black_buf.push(Number(n))}
                    else{white_buf.push(Number(n))}
                }

                if (!flag){
                    var cl = {
                        "name": (d % 2 === 0 ? my_color : op_color) + '-' + n,
                        "children":[],
                        "black": black_pieces.concat(black_buf),
                        "white": white_pieces.concat(white_buf)
                    }
                    cur_d.push(cl)
                    cur_d = cl["children"]
                }
                d += 1
            }
            delete cl["children"]
        }

        this.root = d3.hierarchy(this.data);
        this.root.x0 = this.height / 2;
        this.root.y0 = 0;
        this.root.children.forEach(that.collapse);
    }

    this.collapse = function(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(that.collapse);
            d.children = null;
        }
    }

    this.treeLayout = d3.tree().size([this.height, this.width - 200]);
    // this.root = d3.hierarchy(this.data);
    // this.root.x0 = this.height / 2;
    // this.root.y0 = 0;

    this.svg = d3.select('#sol_dataviz').append('svg')
        .attr('width', this.width)
        .attr('height', this.height)
        .append('g')
        .attr('transform', 'translate(100,0)');

    this.update = function(source) {
        const treeData = this.treeLayout(this.root);
        const nodes = treeData.descendants();
        const links = treeData.descendants().slice(1);

        nodes.forEach(d => d.y = d.depth * 180);

        const node = this.svg.selectAll('g.node')
            .data(nodes, d => d.id || (d.id = ++this.i));

        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .attr('id', d => 'node_' + String(d.id))
            .attr('transform', d => `translate(${source.y0},${source.x0})`)
            .on('click', that.click)
            .on('mouseover', that.mouseover)
            .on('mousemove', that.mousemove)
            .on('mouseout', that.mouseout);


        nodeEnter.append('circle')
            .attr('class', 'node')
            .attr('r', 1e-6)
            .style('fill', d => d._children ? 'lightsteelblue' : '#000000');

        nodeEnter.append('text')
            .attr('dy', '.35em')
            .attr('x', d => d.children || d._children ? -13 : 13)
            .attr('text-anchor', d => d.children || d._children ? 'end' : 'start')
            .text(d => d.data.name);



        const nodeUpdate = nodeEnter.merge(node);

        nodeUpdate.transition()
            .duration(200)
            .attr('transform', d => `translate(${d.y},${d.x})`);

        nodeUpdate.select('circle.node')
            .attr('r', 10)
            .style('fill', d => d._children ? 'lightsteelblue' : '#000000')
            .attr('cursor', 'pointer');

        const nodeExit = node.exit().transition()
            .duration(200)
            .attr('transform', d => `translate(${source.y},${source.x})`)
            .remove();

        nodeExit.select('circle')
            .attr('r', 1e-6);

        nodeExit.select('text')
            .style('fill-opacity', 1e-6);

        const link = this.svg.selectAll('path.link')
            .data(links, d => d.id);

        const linkEnter = link.enter().insert('path', 'g')
            .attr('class', 'link')
            .attr('d', d => {
                const o = {x: source.x0, y: source.y0};
                return that.diagonal(o, o);
            });

        const linkUpdate = linkEnter.merge(link);

        linkUpdate.transition()
            .duration(200)
            .attr('d', d => that.diagonal(d, d.parent));

        link.exit().transition()
            .duration(200)
            .attr('d', d => {
                const o = {x: source.x, y: source.y};
                return that.diagonal(o, o);
            })
            .remove();

        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    this.diagonal = function(s, d) {
        return `M ${s.y} ${s.x}
                    C ${(s.y + d.y) / 2} ${s.x},
                      ${(s.y + d.y) / 2} ${d.x},
                      ${d.y} ${d.x}`;
    }

    this.click = function(event, d) {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else {
            d.children = d._children;
            d._children = null;
        }
        that.update(d);
    }

    this.mouseover = function (event, d){
        that.draw_board(d.data.black, d.data.white)

        // 创建预览窗口元素
        this.preview = document.createElement('div');
        this.preview.classList.add('preview');
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = 450;  // 设定预览窗口的宽度
        previewCanvas.height = 200; // 设定预览窗口的高度
        this.preview.appendChild(previewCanvas);
        document.body.appendChild(this.preview);

        // 在预览 Canvas 上绘制与 sourceCanvas 相同的内容
        const previewCtx = previewCanvas.getContext('2d');
        previewCtx.drawImage(sourceCanvas, 0, 0, previewCanvas.width, previewCanvas.height);


        this.preview.style.display = 'block';
        this.preview.style.left = `${event.pageX + 10}px`; // 调整预览窗口的位置
        this.preview.style.top = `${event.pageY + 10}px`;  // 调整预览窗口的位置
    }

    this.mousemove = function (event, d){
        this.preview.style.left = `${event.pageX + 10}px`;
        this.preview.style.top = `${event.pageY + 10}px`;
    }

    this.mouseout = function (event, d){
        this.preview.style.display = 'none';
    }

    this.draw_board = function(black_pieces, white_pieces){
        // Draw border
        let w = 900
        let h = 400
        let s = Math.floor(Math.min(w/9, h/4));
        let r = s * 0.75 / 2;

        this.ctx.beginPath();
        this.ctx.rect(0, 0, w, h);
        this.ctx.lineWidth = "8";
        this.ctx.strokeStyle = "black";
        this.ctx.stroke();
        this.ctx.lineWidth = "4";
        this.ctx.fillStyle = "#999999";
        this.ctx.fill();
        // Draw grid
        for(let i=1; i<4; i++){
            this.ctx.beginPath();
            this.ctx.moveTo(0, h*i/4);
            this.ctx.lineTo(w, h*i/4);
            this.ctx.stroke();
        }
        for(let i=1; i<9; i++){
            this.ctx.beginPath();
            this.ctx.moveTo(w*i/9, 0);
            this.ctx.lineTo(w*i/9, h);
            this.ctx.stroke();
        }
        for(const piece of black_pieces){
            this.ctx.beginPath();
            let x = piece % 9;
            let y = Math.floor(piece / 9);
            this.ctx.arc((s * x) + s/2, (s * y) + s/2, r, 0, 2 * Math.PI);
            this.ctx.fillStyle="black";
            this.ctx.fill();
        }
        for(const piece of white_pieces){
            this.ctx.beginPath();
            let x = piece % 9;
            let y = Math.floor(piece / 9);
            this.ctx.arc((s * x) + s/2, (s * y) + s/2, r, 0, 2 * Math.PI);
            this.ctx.fillStyle="white";
            this.ctx.fill();
        }
    }
}